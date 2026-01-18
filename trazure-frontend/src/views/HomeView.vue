<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, type UploadFile, type UploadUserFile } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import axios from 'axios'

// --- 🔧 核心变化：Electron 本地存储替代 IndexedDB ---

// ✅ 新增状态：当前存储路径 (只保留这一个定义)
const currentStoragePath = ref('正在读取...')

// 模拟当前用户ID (实际项目中应从 Pinia 用户状态获取)
const CURRENT_USER_DIR = 'User_1001';

// 封装 Electron 调用 (使用 as any 规避临时的 TS 类型检查问题)
const electronAPI = (window as any).electronAPI;

const saveToLocal = async (id: string, file: Blob) => {
  // 1. 将 Blob 转为 ArrayBuffer，因为 Electron IPC 不能直接传 Blob
  const buffer = await file.arrayBuffer();

  // 2. 调用 Electron 主进程写入硬盘
  const result = await electronAPI.saveFile({
    fileName: id,
    buffer: buffer,
    subDir: CURRENT_USER_DIR
  });

  if (!result.success) {
    throw new Error('Electron save failed: ' + result.error);
  }
};

// ✅ 新增函数：初始化读取路径
const loadStoragePath = async () => {
  try {
    const path = await electronAPI.getCurrentStoragePath();
    currentStoragePath.value = path;
  } catch (e) {
    console.error('读取路径失败', e);
  }
}

// ✅ 新增函数：处理修改路径
const handleChangeStorage = async () => {
  try {
    const newPath = await electronAPI.changeStoragePath();
    if (newPath) {
      currentStoragePath.value = newPath;
      ElMessage.success('存储位置已更新！新照片将存入此处。');
      // 注意：这里我们暂时不迁移旧数据，这是V2.0的高级功能
    }
  } catch (e) {
    ElMessage.error('修改失败');
  }
}

const getFromLocal = async (id: string): Promise<Blob | null> => {
  // 1. 从 Electron 获取 Uint8Array (Buffer)
  const buffer = await electronAPI.getFile({
    fileName: id,
    subDir: CURRENT_USER_DIR
  });

  if (!buffer) return null;

  // 2. 转回 Blob 供前端展示
  return new Blob([buffer]);
};

const deleteFromLocal = async (id: string) => {
  await electronAPI.deleteFile({
    fileName: id,
    subDir: CURRENT_USER_DIR
  });
};

// --- 常规业务逻辑 (保持不变) ---

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// 🌍 核心配置
const CONFIG = {
  COUNTRY: {
    SOURCE_ID: 'source-admin-0',
    URL: 'mapbox://jack-lawrence.69ikhr4b',
    LAYER_NAME: 'ne_10m_admin_0_countries-d4gkj4',
    PROMOTE_ID: 'NAME'
  },
  PROVINCE: {
    SOURCE_ID: 'source-admin-1',
    URL: 'mapbox://jack-lawrence.2yx2o4dg',
    LAYER_NAME: 'ne_10m_admin_1_states_provinc-ahipp6',
    PROMOTE_ID: 'name'
  },
  CITY: {
    SOURCE_ID: 'source-admin-2',
    URL: 'mapbox://jack-lawrence.9jo2c1jg',
    LAYER_NAME: 'cities_global-8wtj58',
    PROMOTE_ID: 'GID_2'
  }
}

// 2. 补全分类配置
const CATEGORY_STYLES = [
  { value: 1, label: '旅游', color: '#00ffc8' },
  { value: 2, label: '留学', color: '#00a8ff' },
  { value: 3, label: '定居', color: '#ff9f43' },
  { value: 4, label: '恋爱', color: '#ff5252' },
  { value: 5, label: '出生', color: '#ffd32a' },
  { value: 6, label: '经过', color: '#a4b0be' },
  { value: 7, label: '工作', color: '#ff6b81' },
]

const API_BASE = 'http://localhost:8080'
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true
})

let map: mapboxgl.Map | null = null
let hoveredFeatureId: string | number | null = null

const drawerVisible = ref(false)
const isSubmitting = ref(false)
const selectedLabel = ref('')
const currentMode = ref<'COUNTRY' | 'PROVINCE' | 'CITY' | 'CORNER'>('COUNTRY')

// ✅ 足迹缓存 (RegionID -> FootprintData)
const footprintCache = reactive(new Map<string, any>())

// 3. 图片上传相关状态
const fileList = ref<UploadUserFile[]>([]) // UI文件列表
const pendingUploads = ref<{uuid: string, file: File}[]>([]) // 待绑定的新图片队列

const targetInfo = reactive({
  id: null as string | null,
  name: '',
  lng: 0,
  lat: 0
})

const form = reactive({
  category: 1,
  mood: '',
  description: ''
})

// ✅ 当前正在查看/编辑的足迹ID
const currentFootprintId = ref<number | null>(null)

// ✅ 图片预览相关
const dialogImageUrl = ref('')
const dialogVisible = ref(false)

const setLayerVisibility = (layerIds: string[], isVisible: boolean) => {
  if (!map || !map.getStyle()) return
  layerIds.forEach(id => {
    if (map!.getLayer(id)) {
      map!.setLayoutProperty(id, 'visibility', isVisible ? 'visible' : 'none')
    }
  })
}

const updateLayerVisibility = () => {
  if (!map) return
  const mode = currentMode.value
  const groups = {
    COUNTRY: ['layer-admin0-fill', 'layer-admin0-line'],
    PROVINCE: ['layer-admin1-fill', 'layer-admin1-line'],
    CITY: ['layer-admin2-fill', 'layer-admin2-line'],
    CORNER: []
  }
  Object.values(groups).flat().forEach(id => {
    if (map!.getLayer(id)) map!.setLayoutProperty(id, 'visibility', 'none')
  })
  // @ts-ignore
  const activeLayers = groups[mode] || []
  setLayerVisibility(activeLayers, true)
}

const switchMode = (mode: 'COUNTRY' | 'PROVINCE' | 'CITY' | 'CORNER') => {
  currentMode.value = mode
  updateLayerVisibility()
  if (mode === 'COUNTRY') map!.flyTo({ zoom: 2.5, pitch: 0 })
  else if (mode === 'PROVINCE') map!.flyTo({ zoom: 4, pitch: 0 })
  else if (mode === 'CITY') map!.flyTo({ zoom: 8, pitch: 45 })
  else map!.flyTo({ zoom: 14, pitch: 60 })
}

// ✅ 核心升级：从 Electron 本地文件系统加载图片
const fetchMediaAssets = async (footprintId: number) => {
  fileList.value = [] // 清空列表
  try {
    // 1. 问后端：这个足迹有哪些文件名？
    const res = await api.get(`/media/list/${footprintId}`)
    const assets = res.data

    // 2. 问 Electron：这些文件名的图片数据在哪？
    for (const asset of assets) {
      // 🚀 调用 Electron 读取硬盘
      const blob = await getFromLocal(asset.fileName)
      if (blob) {
        // 生成浏览器内存 URL
        const url = URL.createObjectURL(blob)
        fileList.value.push({
          name: asset.fileName,
          url: url,
          // @ts-ignore (存储数据库ID用于删除)
          id: asset.id
        })
      }
    }
  } catch (e) {
    console.error('获取图片失败', e)
  }
}

// ✅ 核心升级：加载所有足迹并缓存
const loadFootprints = async () => {
  try {
    const res = await api.get('/footprints/list')
    const footprints = res.data
    footprints.forEach((fp: any) => {
      footprintCache.set(fp.regionId, fp)

      let cfg = CONFIG.CITY
      if (fp.layerType === 'COUNTRY') cfg = CONFIG.COUNTRY
      else if (fp.layerType === 'PROVINCE') cfg = CONFIG.PROVINCE

      const style = CATEGORY_STYLES.find(c => c.value === fp.category)
      const color = style ? style.color : '#ffffff'

      if (fp.regionId && map && map.getSource(cfg.SOURCE_ID)) {
        const setJson = () => map!.setFeatureState(
          { source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: fp.regionId },
          { occupied: true, color: color }
        )
        if (map.isSourceLoaded(cfg.SOURCE_ID)) setJson()
        else map.once('sourcedata', setJson)
      }
    })
    console.log('✅ 已从云端加载足迹:', footprints.length)
  } catch (error) {
    console.error('加载足迹失败:', error)
  }
}

// --- 📸 逻辑2：选择图片 (存 Electron 本地，不上传) ---
const handleFileChange = async (uploadFile: UploadFile) => {
  if (!uploadFile.raw) return

  // ✅ 优化：获取真实后缀名 (如 .jpg, .png)
  const extension = uploadFile.name.substring(uploadFile.name.lastIndexOf('.'))
  // 拼凑 UUID + 真实后缀
  const uuid = crypto.randomUUID() + extension

  // 2. 🚀 调用 Electron 写入硬盘
  try {
    await saveToLocal(uuid, uploadFile.raw)

    // 3. 放入待绑定队列 (给后端记账用)
    pendingUploads.value.push({ uuid: uuid, file: uploadFile.raw })

    // 4. 修改组件自动添加的文件名为 UUID
    uploadFile.name = uuid
    uploadFile.status = 'success'
  } catch (e) {
    ElMessage.error('本地存储失败: ' + e)
    // 可以在这里从 fileList 移除该文件
  }
}

// ✅ 处理删除（同时清理 Electron 本地文件和后端元数据）
const handleRemove = async (uploadFile: UploadFile) => {
  // A. 如果是旧图 (有数据库 ID)
  // @ts-ignore
  if (uploadFile.id) {
    try {
      // 1. 告诉后端删元数据
      // @ts-ignore
      await api.delete(`/media/delete/${uploadFile.id}`)
      // 2. 🚀 调用 Electron 删本地文件
      await deleteFromLocal(uploadFile.name)
      ElMessage.success('已删除')
    } catch (e) {
      ElMessage.error('删除失败')
    }
  }
  // B. 如果是刚选的新图 (还没点保存)
  else {
    const index = pendingUploads.value.findIndex(p => p.uuid === uploadFile.name)
    if (index > -1) {
      // 🚀 调用 Electron 删本地文件
      await deleteFromLocal(uploadFile.name)
      pendingUploads.value.splice(index, 1)
    }
  }
}

// ✅ 处理图片预览
const handlePictureCardPreview = (uploadFile: UploadFile) => {
  dialogImageUrl.value = uploadFile.url!
  dialogVisible.value = true
}

// 5. 升级版提交逻辑
const handleSubmit = async () => {
  if (!map) return
  isSubmitting.value = true
  const finalRegionId = targetInfo.id || `CORNER_${Date.now()}_${Math.floor(Math.random()*1000)}`

  try {
    // A. 构造足迹数据
    const footprintData = {
      id: currentFootprintId.value,
      userId: 1,
      regionId: finalRegionId,
      layerType: currentMode.value,
      latitude: targetInfo.lat,
      longitude: targetInfo.lng,
      locationName: targetInfo.name,
      category: form.category,
      mood: form.mood,
      description: form.description,
      visitTime: new Date().toISOString()
    }

    // B. 发送足迹，获取 ID
    const res = await api.post('/footprints/light-up', footprintData)
    const newFootprintId = res.data

    // C. 绑定新图片 (只发 UUID 给后端，不发文件)
    if (pendingUploads.value.length > 0) {
      for (const item of pendingUploads.value) {
        await api.post('/media/bind', {
          footprintId: newFootprintId,
          type: 1,
          fileName: item.uuid // 把 UUID 发给后端记账
        })
      }
    }

    // D. 更新本地缓存
    footprintCache.set(finalRegionId, { ...footprintData, id: newFootprintId })

    // E. 视觉反馈
    const color = CATEGORY_STYLES.find(c => c.value === form.category)!.color

    if (currentMode.value !== 'CORNER' && targetInfo.id) {
      const cfg = CONFIG[currentMode.value]
      if (cfg) {
        map!.setFeatureState(
          { source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: targetInfo.id },
          { occupied: true, color: color }
        )
      }
    } else {
      const el = document.createElement('div')
      el.className = 'corner-pin'
      el.style.borderColor = color
      el.innerHTML = `<div class="pin-head" style="background:${color}"></div>`
      new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([targetInfo.lng, targetInfo.lat])
        .addTo(map!)
    }
    ElMessage.success(`✨ 点亮成功：${targetInfo.name}`)
    drawerVisible.value = false

    // F. 清理暂存区
    pendingUploads.value = []
    if (newFootprintId) fetchMediaAssets(newFootprintId)

  } catch (error) {
    console.error(error)
    ElMessage.error('点亮失败，请检查后端服务')
  } finally {
    isSubmitting.value = false
  }
}

const addVectorLayer = (type: 'COUNTRY' | 'PROVINCE' | 'CITY') => {
  const cfg = CONFIG[type]
  let layerPrefix = 'layer-admin0'
  if (type === 'PROVINCE') layerPrefix = 'layer-admin1'
  if (type === 'CITY') layerPrefix = 'layer-admin2'

  if (!map!.getSource(cfg.SOURCE_ID)) {
    map!.addSource(cfg.SOURCE_ID, {
      type: 'vector',
      url: cfg.URL,
      promoteId: cfg.PROMOTE_ID
    })
  }
  map!.addLayer({
    'id': `${layerPrefix}-fill`,
    'type': 'fill',
    'source': cfg.SOURCE_ID,
    'source-layer': cfg.LAYER_NAME,
    'layout': { 'visibility': 'visible' },
    'paint': {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'occupied'], false], ['feature-state', 'color'],
        ['boolean', ['feature-state', 'hover'], false], 'rgba(255, 255, 255, 0.2)',
        'rgba(0, 0, 0, 0)'
      ],
      'fill-opacity': 0.8
    }
  })
  map!.addLayer({
    'id': `${layerPrefix}-line`,
    'type': 'line',
    'source': cfg.SOURCE_ID,
    'source-layer': cfg.LAYER_NAME,
    'layout': { 'visibility': 'visible' },
    'paint': {
      'line-color': 'rgba(255, 255, 255, 0.15)',
      'line-width': type === 'COUNTRY' ? 1 : 0.5
    }
  })
}

onMounted(() => {
  map = new mapboxgl.Map({
    container: 'map-container',
    style: 'mapbox://styles/mapbox/dark-v11',
    projection: 'globe',
    center: [105, 35],
    zoom: 2.5,
    pitch: 0,
  })

  map.on('style.load', () => {
    map!.setFog({ color: 'rgb(10, 10, 20)', 'high-color': 'rgb(0, 0, 0)', 'space-color': 'rgb(0, 0, 0)', 'star-intensity': 1.0 })
    map!.addSource('mapbox-dem', { 'type': 'raster-dem', 'url': 'mapbox://mapbox.mapbox-terrain-dem-v1', 'tileSize': 512, 'maxzoom': 14 })
    map!.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 })

    if (!map!.getLayer('3d-buildings')) {
      const layers = map!.getStyle().layers;
      let labelLayerId;
      for (const layer of layers) {
        if (layer.type === 'symbol' && layer.layout['text-field']) {
          labelLayerId = layer.id;
          break;
        }
      }

      map!.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 14,
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            14, 0,
            14.05, ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            14, 0,
            14.05, ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      }, labelLayerId)
    }

    addVectorLayer('COUNTRY')
    addVectorLayer('PROVINCE')
    addVectorLayer('CITY')

    updateLayerVisibility()
    loadFootprints()
    loadStoragePath(); // 👈 启动时读取一次路径
  })

  const handleInteraction = (e: mapboxgl.MapMouseEvent, isClick: boolean) => {
    const mode = currentMode.value
    if (mode === 'CORNER') {
      if (isClick) {
        targetInfo.id = null
        targetInfo.name = '未知角落'
        targetInfo.lng = e.lngLat.lng
        targetInfo.lat = e.lngLat.lat
        selectedLabel.value = '标记角落'
        drawerVisible.value = true
        fileList.value = []
        pendingUploads.value = []
        form.mood = ''
        form.description = ''
        currentFootprintId.value = null
      }
      return
    }

    const cfg = CONFIG[mode]
    let layerId = 'layer-admin0-fill'
    if (mode === 'PROVINCE') layerId = 'layer-admin1-fill'
    if (mode === 'CITY') layerId = 'layer-admin2-fill'

    const features = map!.queryRenderedFeatures(e.point, { layers: [layerId] })

    if (features.length > 0) {
      map!.getCanvas().style.cursor = 'pointer'
      const feat = features[0]
      const id = feat.id as string

      if (!isClick) {
        if (hoveredFeatureId !== id) {
          if (hoveredFeatureId) map!.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: false })
          hoveredFeatureId = id
          map!.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: true })
        }
      } else {
        targetInfo.id = id
        targetInfo.name = feat.properties?.['NAME_2'] || feat.properties?.['name'] || feat.properties?.['NAME'] || id
        targetInfo.lng = e.lngLat.lng
        targetInfo.lat = e.lngLat.lat
        selectedLabel.value = targetInfo.name

        // 🔍 检查缓存：回显数据
        const existingData = footprintCache.get(id)
        if (existingData) {
          form.category = existingData.category || 1
          form.mood = existingData.mood || ''
          form.description = existingData.description || ''
          currentFootprintId.value = existingData.id
          fetchMediaAssets(existingData.id)
        } else {
          form.category = 1
          form.mood = ''
          form.description = ''
          currentFootprintId.value = null
          fileList.value = []
        }

        pendingUploads.value = []
        drawerVisible.value = true
      }
    } else {
      map!.getCanvas().style.cursor = ''
      if (isClick && mode === 'CITY') {
        targetInfo.lng = e.lngLat.lng
        targetInfo.lat = e.lngLat.lat
        selectedLabel.value = '未知区域'
        targetInfo.id = null
        targetInfo.name = '未知坐标'
        drawerVisible.value = true
        fileList.value = []
        pendingUploads.value = []
        currentFootprintId.value = null
      }
      if (!isClick && hoveredFeatureId) {
        map!.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: false })
        hoveredFeatureId = null
      }
    }
  }

  map.on('mousemove', (e) => handleInteraction(e, false))
  map.on('click', (e) => handleInteraction(e, true))
})
</script>

<template>
  <div class="page-container">
    <div id="map-container" @contextmenu.prevent></div>

    <div class="level-switcher">
      <div class="switch-bg">
        <div class="switch-item" :class="{ active: currentMode === 'COUNTRY' }" @click="switchMode('COUNTRY')">
          🌍 国家
        </div>
        <div class="switch-item" :class="{ active: currentMode === 'PROVINCE' }" @click="switchMode('PROVINCE')">
          🗺️ 省份
        </div>
        <div class="switch-item" :class="{ active: currentMode === 'CITY' }" @click="switchMode('CITY')">
          🏙️ 城市
        </div>
        <div class="switch-item" :class="{ active: currentMode === 'CORNER' }" @click="switchMode('CORNER')">
          📍 角落
        </div>
      </div>
    </div>

    <el-drawer v-model="drawerVisible" :title="selectedLabel" size="380px" class="custom-drawer">

      <div class="drawer-content">
        <div class="storage-manager">
          <div class="storage-label">当前存储位置:</div>
          <div class="storage-path" :title="currentStoragePath">{{ currentStoragePath }}</div>
          <el-button size="small" type="warning" plain @click="handleChangeStorage" class="change-btn">
            📂 更改目录
          </el-button>
        </div>
        <el-divider style="margin: 15px 0; border-color: #333;" />

        <el-form label-position="top">
          <el-form-item label="类型">
            <div class="color-options">
              <div
                v-for="c in CATEGORY_STYLES" :key="c.value" class="color-circle"
                :style="{ background: c.color, border: form.category === c.value ? '2px solid white' : 'none' }"
                @click="form.category = c.value"
              ></div>
            </div>
            <div class="color-label" :style="{color: CATEGORY_STYLES.find(c=>c.value===form.category)?.color}">
              {{ CATEGORY_STYLES.find(c=>c.value===form.category)?.label }}
            </div>
          </el-form-item>

          <el-form-item label="记忆胶囊 (本地存储)">
            <el-upload
              v-model:file-list="fileList"
              action="#"
              :auto-upload="false"
              list-type="picture-card"
              :on-change="handleFileChange"
              :on-preview="handlePictureCardPreview"
              :on-remove="handleRemove"
            >
              <el-icon><Plus /></el-icon>
            </el-upload>

            <el-dialog v-model="dialogVisible">
              <img w-full :src="dialogImageUrl" alt="Preview Image" style="width: 100%" />
            </el-dialog>
          </el-form-item>

          <el-form-item label="心情">
            <el-input v-model="form.mood" type="textarea" placeholder="写下这一刻..." />
          </el-form-item>

          <el-form-item label="详细故事">
            <el-input v-model="form.description" type="textarea" rows="3" placeholder="Markdown 格式日记..." />
          </el-form-item>

          <el-button type="primary" class="glow-btn" @click="handleSubmit" :loading="isSubmitting"
                     :style="{ background: CATEGORY_STYLES.find(c=>c.value===form.category)?.color }">
            {{ isSubmitting ? '同步云端中...' : '点亮记忆 ✨' }}
          </el-button>
        </el-form>
      </div>
    </el-drawer>
  </div>
</template>

<style>
/* 样式保持不变 */
body { margin: 0; background: #000; overflow: hidden; }
.page-container { width: 100vw; height: 100vh; position: relative; }
#map-container { width: 100%; height: 100%; position: absolute; }
.level-switcher { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); z-index: 10; }
.switch-bg { display: flex; background: rgba(10, 10, 15, 0.85); backdrop-filter: blur(12px); padding: 5px; border-radius: 40px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 10px 40px rgba(0,0,0,0.6); }
.switch-item { padding: 8px 18px; border-radius: 30px; color: #888; cursor: pointer; font-weight: bold; font-size: 14px; transition: all 0.3s; white-space: nowrap; }
.switch-item:hover { color: #fff; }
.switch-item.active { background: linear-gradient(135deg, #00ffc8, #00a8ff); color: #000; box-shadow: 0 4px 15px rgba(0, 255, 200, 0.3); }
.corner-pin { width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 16px solid #ff5252; position: relative; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.5)); }
.pin-head { position: absolute; top: -24px; left: -10px; width: 20px; height: 20px; border-radius: 50%; background: #ff5252; border: 2px solid #fff; }

/* 抽屉美化 */
.custom-drawer .el-drawer__body { background: #111; padding: 25px; }
.custom-drawer .el-drawer__header { color: #fff; background: #111; margin: 0; padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.el-form-item__label { color: #888 !important; }
.el-input__wrapper, .el-textarea__inner { background-color: #222 !important; box-shadow: none !important; border: 1px solid #333; color: #fff; }
.el-upload--picture-card { background-color: #222; border: 1px dashed #444; }
.el-upload--picture-card:hover { border-color: #00ffc8; }
.el-dialog { background: #111; border: 1px solid #333; }
.el-dialog__header { color: #fff; }

.color-options { display: flex; gap: 12px; margin-bottom: 5px; flex-wrap: wrap; }
.color-circle { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; transition: transform 0.2s;}
.color-circle:hover { transform: scale(1.2); }
.color-label { font-size: 14px; font-weight: bold; margin-top: 8px; }
.glow-btn { width: 100%; border: none; font-weight: bold; color: #000; height: 42px; margin-top: 20px; border-radius: 8px; }

.storage-manager {
  background: #222;
  padding: 10px;
  border-radius: 6px;
  border: 1px dashed #444;
  margin-bottom: 10px;
}
.storage-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}
.storage-path {
  font-size: 13px;
  color: #00ffc8;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}
.change-btn {
  width: 100%;
  background: transparent;
  border-color: #555;
  color: #ccc;
}
.change-btn:hover {
  border-color: #e6a23c;
  color: #e6a23c;
}
</style>

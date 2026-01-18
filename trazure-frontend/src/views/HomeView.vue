<script setup lang="ts">
// ✅ 修复 1: 引入 computed
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage, type UploadFile, type UploadUserFile } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import axios from 'axios'
import mapboxgl from 'mapbox-gl'

// ✅ 引入“工具包”
import { useFileSystem } from '@/composables/useFileSystem'
import { useMapbox } from '@/composables/useMapbox'
import { useUserStore } from '@/stores/user' // 1. 引入 Store
import { storeToRefs } from 'pinia'

// 获取当前用户
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

// 动态生成用户目录
// 如果用户是 Jack (id=1)，目录就是 "User_Jack_1"
// 这样可以保证唯一性，也容易辨识
const CURRENT_USER_DIR = computed(() => {
  // 增加一个安全判断，防止未登录时报错
  if (!userInfo.value || !userInfo.value.username) return 'User_Guest'
  return `User_${userInfo.value.username}_${userInfo.value.id}`
})

// 拆包：文件系统能力
// ✅ 修复 2: 使用 .value 获取计算属性的字符串值
const {
  currentStoragePath,
  loadStoragePath,
  changeStoragePath,
  saveToLocal,
  getFromLocal,
  deleteFromLocal
} = useFileSystem(CURRENT_USER_DIR.value)

// 拆包：地图能力
const {
  map,
  currentMode,
  CONFIG,
  initMap,
  switchMode,
  highlightRegion,
  addCornerMarker
} = useMapbox()


// --- 2. 业务状态定义 ---

const API_BASE = 'http://localhost:8080'
const api = axios.create({ baseURL: API_BASE, withCredentials: true })

const CATEGORY_STYLES = [
  { value: 1, label: '旅游', color: '#00ffc8' },
  { value: 2, label: '留学', color: '#00a8ff' },
  { value: 3, label: '定居', color: '#ff9f43' },
  { value: 4, label: '恋爱', color: '#ff5252' },
  { value: 5, label: '出生', color: '#ffd32a' },
  { value: 6, label: '经过', color: '#a4b0be' },
  { value: 7, label: '工作', color: '#ff6b81' },
]

// 交互 UI 状态
const drawerVisible = ref(false)
const isSubmitting = ref(false)
const selectedLabel = ref('')
const footprintCache = reactive(new Map<string, any>()) // 缓存足迹数据
let hoveredFeatureId: string | null = null // 保持为局部变量

// 表单数据
const form = reactive({ category: 1, mood: '', description: '' })
const targetInfo = reactive({ id: null as string | null, name: '', lng: 0, lat: 0 })
const currentFootprintId = ref<number | null>(null)

// 图片列表与预览
const fileList = ref<UploadUserFile[]>([])
const pendingUploads = ref<{uuid: string, file: File}[]>([])
const dialogImageUrl = ref('')
const dialogVisible = ref(false)


// --- 3. 核心业务逻辑 ---

// ✅ 加载足迹：从云端拉取数据 -> 调用 Mapbox 工具包画图
const loadFootprints = async () => {
  try {
    const res = await api.get('/footprints/list')
    res.data.forEach((fp: any) => {
      footprintCache.set(fp.regionId, fp)
      const style = CATEGORY_STYLES.find(c => c.value === fp.category)
      const color = style ? style.color : '#ffffff'

      // 使用工具包方法高亮区域
      highlightRegion(fp.regionId, fp.layerType, color)
    })
    console.log('✅ 足迹加载完成:', res.data.length)
  } catch (error) {
    console.error('加载足迹失败:', error)
  }
}

// ✅ 加载图片：从云端拿文件名 -> 调用 FileSystem 工具包读硬盘
const fetchMediaAssets = async (footprintId: number) => {
  fileList.value = []
  try {
    const res = await api.get(`/media/list/${footprintId}`)
    for (const asset of res.data) {
      // 使用工具包方法读取本地文件
      const blob = await getFromLocal(asset.fileName)
      if (blob) {
        fileList.value.push({
          name: asset.fileName,
          url: URL.createObjectURL(blob),
          // @ts-ignore
          id: asset.id
        })
      }
    }
  } catch (e) {
    console.error('获取图片失败', e)
  }
}

// ✅ 图片变动：调用 FileSystem 工具包存硬盘
const handleFileChange = async (uploadFile: UploadFile) => {
  if (!uploadFile.raw) return
  const extension = uploadFile.name.substring(uploadFile.name.lastIndexOf('.'))
  const uuid = crypto.randomUUID() + extension

  try {
    // 存入本地
    await saveToLocal(uuid, uploadFile.raw)

    // 加入待提交队列
    pendingUploads.value.push({ uuid: uuid, file: uploadFile.raw })
    uploadFile.name = uuid
    uploadFile.status = 'success'
  } catch (e: any) {
    ElMessage.error('存储失败: ' + e.message)
  }
}

// ✅ 删除图片：调用 FileSystem 工具包删硬盘
const handleRemove = async (uploadFile: UploadFile) => {
  // @ts-ignore
  if (uploadFile.id) { // 旧图 (已入库)
    try {
      // @ts-ignore
      await api.delete(`/media/delete/${uploadFile.id}`)
      await deleteFromLocal(uploadFile.name)
      ElMessage.success('已删除')
    } catch (e) { ElMessage.error('删除失败') }
  } else { // 新图 (未入库)
    const index = pendingUploads.value.findIndex(p => p.uuid === uploadFile.name)
    if (index > -1) {
      await deleteFromLocal(uploadFile.name)
      pendingUploads.value.splice(index, 1)
    }
  }
}

// ✅ 提交表单 (点亮)
const handleSubmit = async () => {
  isSubmitting.value = true
  const finalRegionId = targetInfo.id || `CORNER_${Date.now()}_${Math.floor(Math.random()*1000)}`

  try {
    // 1. 存云端元数据
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
    const res = await api.post('/footprints/light-up', footprintData)
    const newId = res.data

    // 2. 绑定图片 (仅发送 UUID)
    for (const item of pendingUploads.value) {
      await api.post('/media/bind', { footprintId: newId, type: 1, fileName: item.uuid })
    }

    // 3. 更新 UI 和缓存
    footprintCache.set(finalRegionId, { ...footprintData, id: newId })
    const color = CATEGORY_STYLES.find(c => c.value === form.category)!.color

    if (currentMode.value !== 'CORNER' && targetInfo.id) {
      highlightRegion(targetInfo.id, currentMode.value, color)
    } else {
      addCornerMarker(targetInfo.lng, targetInfo.lat, color)
    }

    ElMessage.success(`✨ 点亮成功：${targetInfo.name}`)
    drawerVisible.value = false
    pendingUploads.value = []
    if (newId) fetchMediaAssets(newId)

  } catch (error) {
    console.error(error)
    ElMessage.error('提交失败')
  } finally {
    isSubmitting.value = false
  }
}

// 图片预览 helper
const handlePictureCardPreview = (uploadFile: UploadFile) => {
  dialogImageUrl.value = uploadFile.url!
  dialogVisible.value = true
}

// 辅助：打开抽屉的几种情况 (保持原有逻辑)
const openDrawerForCorner = (e: mapboxgl.MapMouseEvent) => {
  resetForm()
  targetInfo.id = null
  targetInfo.name = '未知角落'
  targetInfo.lng = e.lngLat.lng
  targetInfo.lat = e.lngLat.lat
  selectedLabel.value = '标记角落'
  drawerVisible.value = true
}

const openDrawerForRegion = (feat: any, e: mapboxgl.MapMouseEvent) => {
  const id = feat.id as string
  targetInfo.id = id
  targetInfo.name = feat.properties?.['NAME_2'] || feat.properties?.['name'] || feat.properties?.['NAME'] || id
  targetInfo.lng = e.lngLat.lng
  targetInfo.lat = e.lngLat.lat
  selectedLabel.value = targetInfo.name

  // 回显数据
  const data = footprintCache.get(id)
  if (data) {
    form.category = data.category
    form.mood = data.mood
    form.description = data.description
    currentFootprintId.value = data.id
    fetchMediaAssets(data.id)
  } else {
    resetForm()
  }
  drawerVisible.value = true
}

const openDrawerForUnknown = (e: mapboxgl.MapMouseEvent) => {
  resetForm()
  targetInfo.id = null
  targetInfo.name = '未知坐标'
  targetInfo.lng = e.lngLat.lng
  targetInfo.lat = e.lngLat.lat
  selectedLabel.value = '未知区域'
  drawerVisible.value = true
}

const resetForm = () => {
  form.category = 1
  form.mood = ''
  form.description = ''
  currentFootprintId.value = null
  fileList.value = []
  pendingUploads.value = []
}


// --- 4. 生命周期与地图交互 ---

onMounted(() => {
  // 1. 读取路径
  loadStoragePath()

  // 2. 初始化地图 (传入 DOM ID 和 加载完成后的回调)
  initMap('map-container', () => {
    // 地图加载完成后，立刻拉取足迹数据
    loadFootprints()

    // 绑定交互事件
    const m = map.value!
    m.on('mousemove', (e) => handleInteraction(e, false))
    m.on('click', (e) => handleInteraction(e, true))
  })
})

// 地图交互逻辑 (保持原来的核心逻辑，通过 map.value 操作)
const handleInteraction = (e: mapboxgl.MapMouseEvent, isClick: boolean) => {
  const m = map.value!
  if (currentMode.value === 'CORNER') {
    if (isClick) openDrawerForCorner(e)
    return
  }

  // 动态判断当前层级 (使用 useMapbox 导出的 CONFIG)
  let layerId = 'layer-admin0-fill'
  if (currentMode.value === 'PROVINCE') layerId = 'layer-admin1-fill'
  if (currentMode.value === 'CITY') layerId = 'layer-admin2-fill'
  const cfg = CONFIG[currentMode.value]

  const features = m.queryRenderedFeatures(e.point, { layers: [layerId] })

  if (features.length > 0) {
    m.getCanvas().style.cursor = 'pointer'
    const feat = features[0]
    const id = feat.id as string

    if (!isClick) {
      // Hover 效果
      if (hoveredFeatureId !== id) {
        if (hoveredFeatureId) m.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: false })
        hoveredFeatureId = id
        m.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: true })
      }
    } else {
      // Click 效果
      openDrawerForRegion(feat, e)
    }
  } else {
    m.getCanvas().style.cursor = ''
    if (isClick && currentMode.value === 'CITY') openDrawerForUnknown(e)
    if (!isClick && hoveredFeatureId) {
      m.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: false })
      hoveredFeatureId = null
    }
  }
}
</script>

<template>
  <div class="page-container">
    <div id="map-container" @contextmenu.prevent></div>

    <div class="level-switcher">
      <div class="switch-bg">
        <div class="switch-item" :class="{ active: currentMode === 'COUNTRY' }" @click="switchMode('COUNTRY')">🌍 国家</div>
        <div class="switch-item" :class="{ active: currentMode === 'PROVINCE' }" @click="switchMode('PROVINCE')">🗺️ 省份</div>
        <div class="switch-item" :class="{ active: currentMode === 'CITY' }" @click="switchMode('CITY')">🏙️ 城市</div>
        <div class="switch-item" :class="{ active: currentMode === 'CORNER' }" @click="switchMode('CORNER')">📍 角落</div>
      </div>
    </div>

    <el-drawer v-model="drawerVisible" :title="selectedLabel" size="380px" class="custom-drawer">
      <div class="drawer-content">

        <div class="storage-manager">
          <div class="storage-label">当前存储位置:</div>
          <div class="storage-path" :title="currentStoragePath">{{ currentStoragePath }}</div>
          <el-button size="small" type="warning" plain @click="changeStoragePath" class="change-btn">
            📂 更改目录
          </el-button>
        </div>
        <el-divider style="margin: 15px 0; border-color: #333;" />

        <el-form label-position="top">
          <el-form-item label="类型">
            <div class="color-options">
              <div v-for="c in CATEGORY_STYLES" :key="c.value" class="color-circle"
                   :style="{ background: c.color, border: form.category === c.value ? '2px solid white' : 'none' }"
                   @click="form.category = c.value"></div>
            </div>
            <div class="color-label" :style="{color: CATEGORY_STYLES.find(c=>c.value===form.category)?.color}">
              {{ CATEGORY_STYLES.find(c=>c.value===form.category)?.label }}
            </div>
          </el-form-item>

          <el-form-item label="记忆胶囊 (本地存储)">
            <el-upload v-model:file-list="fileList" action="#" :auto-upload="false" list-type="picture-card"
                       :on-change="handleFileChange" :on-preview="handlePictureCardPreview" :on-remove="handleRemove">
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
/* 保持原有样式完全不变 */
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

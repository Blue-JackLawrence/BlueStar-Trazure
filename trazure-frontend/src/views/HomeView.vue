<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type UploadFile, type UploadUserFile } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import axios from 'axios'
import mapboxgl from 'mapbox-gl'

// 引入工具包
import { useFileSystem } from '@/composables/useFileSystem'
import { useMapbox } from '@/composables/useMapbox'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'

// 1. 初始化路由与用户
const router = useRouter()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

// 2. 动态生成用户目录
// ⚠️ 如果你以前的图片存在 User_1001，请手动将该文件夹重命名为 User_Jack Lawrence_1
const CURRENT_USER_DIR = computed(() => {
  if (!userInfo.value || !userInfo.value.username) return 'User_Guest'
  return `User_${userInfo.value.username}`
})

// 3. 拆包：文件系统能力
// 🟢 关键修正：这里直接传 Ref 对象 (不要加 .value)，保证用户切换时路径自动更新
const {
  currentStoragePath,
  loadStoragePath,
  changeStoragePath,
  saveToLocal,
  getFromLocal,
  deleteFromLocal
} = useFileSystem(CURRENT_USER_DIR)

// 4. 拆包：地图能力
const {
  map,
  currentMode,
  CONFIG,
  initMap,
  switchMode,
  highlightRegion,
  addCornerMarker
} = useMapbox()


// --- 业务状态定义 ---

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
const footprintCache = reactive(new Map<string, any>())
let hoveredFeatureId: string | null = null

// 表单数据
const form = reactive({ category: 1, mood: '', description: '' })
const targetInfo = reactive({ id: null as string | null, name: '', lng: 0, lat: 0 })
const currentFootprintId = ref<number | null>(null)

// 图片列表与预览
const fileList = ref<UploadUserFile[]>([])
const pendingUploads = ref<{uuid: string, file: File}[]>([])
const dialogImageUrl = ref('')
const dialogVisible = ref(false)


// --- 核心业务逻辑 ---

// 加载足迹
const loadFootprints = async () => {
  try {
    const res = await api.get('/footprints/list')
    res.data.forEach((fp: any) => {
      footprintCache.set(fp.regionId, fp)
      const style = CATEGORY_STYLES.find(c => c.value === fp.category)
      const color = style ? style.color : '#ffffff'
      highlightRegion(fp.regionId, fp.layerType, color)
    })
    console.log('✅ 足迹加载完成:', res.data.length)
  } catch (error) {
    console.error('加载足迹失败:', error)
  }
}

// 加载图片
const fetchMediaAssets = async (footprintId: number) => {
  fileList.value = []
  try {
    const res = await api.get(`/media/list/${footprintId}`)
    for (const asset of res.data) {
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

// 图片变动
const handleFileChange = async (uploadFile: UploadFile) => {
  if (!uploadFile.raw) return
  const extension = uploadFile.name.substring(uploadFile.name.lastIndexOf('.'))
  const uuid = crypto.randomUUID() + extension

  try {
    await saveToLocal(uuid, uploadFile.raw)
    pendingUploads.value.push({ uuid: uuid, file: uploadFile.raw })
    uploadFile.name = uuid
    uploadFile.status = 'success'
  } catch (e: any) {
    ElMessage.error('存储失败: ' + e.message)
  }
}

// 删除图片
const handleRemove = async (uploadFile: UploadFile) => {
  // @ts-ignore
  if (uploadFile.id) {
    try {
      // @ts-ignore
      await api.delete(`/media/delete/${uploadFile.id}`)
      await deleteFromLocal(uploadFile.name)
      ElMessage.success('已删除')
    } catch (e) { ElMessage.error('删除失败') }
  } else {
    const index = pendingUploads.value.findIndex(p => p.uuid === uploadFile.name)
    if (index > -1) {
      await deleteFromLocal(uploadFile.name)
      pendingUploads.value.splice(index, 1)
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  isSubmitting.value = true
  const finalRegionId = targetInfo.id || `CORNER_${Date.now()}_${Math.floor(Math.random()*1000)}`

  try {
    const footprintData = {
      id: currentFootprintId.value,
      userId: userInfo.value.id || 1, // 使用真实用户ID
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

    for (const item of pendingUploads.value) {
      await api.post('/media/bind', { footprintId: newId, type: 1, fileName: item.uuid })
    }

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

const handlePictureCardPreview = (uploadFile: UploadFile) => {
  dialogImageUrl.value = uploadFile.url!
  dialogVisible.value = true
}

// 辅助逻辑
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


// --- 生命周期 ---

onMounted(() => {
  loadStoragePath()
  initMap('map-container', () => {
    loadFootprints()
    const m = map.value!
    m.on('mousemove', (e) => handleInteraction(e, false))
    m.on('click', (e) => handleInteraction(e, true))
  })
})

const handleInteraction = (e: mapboxgl.MapMouseEvent, isClick: boolean) => {
  const m = map.value!
  if (currentMode.value === 'CORNER') {
    if (isClick) openDrawerForCorner(e)
    return
  }

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
      if (hoveredFeatureId !== id) {
        if (hoveredFeatureId) m.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: false })
        hoveredFeatureId = id
        m.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: true })
      }
    } else {
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

    <div class="user-avatar-btn" @click="router.push('/user')">
      <img v-if="userInfo.avatar" :src="userInfo.avatar" />
      <div v-else class="avatar-placeholder">{{ userInfo.username?.[0]?.toUpperCase() || 'U' }}</div>
    </div>

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

/* 用户头像样式 */
.user-avatar-btn {
  position: absolute;
  top: 30px;
  right: 30px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  cursor: pointer;
  z-index: 20;
  overflow: hidden;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.user-avatar-btn:hover {
  border-color: #00ffc8;
  transform: scale(1.1);
  box-shadow: 0 0 15px rgba(0, 255, 200, 0.3);
}
.avatar-placeholder {
  color: #fff;
  font-weight: bold;
  font-size: 18px;
}
.user-avatar-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>

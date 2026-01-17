<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElLoading } from 'element-plus'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// 🌍 核心配置
const CONFIG = {
  // 国家 (Admin 0)
  COUNTRY: {
    SOURCE_ID: 'source-admin-0',
    URL: 'mapbox://jack-lawrence.69ikhr4b',
    LAYER_NAME: 'ne_10m_admin_0_countries-d4gkj4',
    PROMOTE_ID: 'NAME'
  },
  // 省份 (Admin 1)
  PROVINCE: {
    SOURCE_ID: 'source-admin-1',
    URL: 'mapbox://jack-lawrence.2yx2o4dg',
    LAYER_NAME: 'ne_10m_admin_1_states_provinc-ahipp6',
    PROMOTE_ID: 'name'
  },
  // 🏙️ 城市 (Admin 2 - 全球正式版)
  CITY: {
    SOURCE_ID: 'source-admin-2',
    // 🟥 全球城市 Tileset ID (已更新)
    URL: 'mapbox://jack-lawrence.9jo2c1jg',
    // 🟥 Layer Name (已更新)
    LAYER_NAME: 'cities_global-8wtj58',
    // 🔑 我们清洗数据时专门保留的城市名字段
    PROMOTE_ID: 'NAME_2'
  }
}

const CATEGORY_STYLES = [
  { value: 1, label: '旅游', color: '#00ffc8' },
  { value: 2, label: '留学', color: '#00a8ff' },
  { value: 3, label: '定居', color: '#ff9f43' },
  { value: 4, label: '恋爱', color: '#ff5252' },
  { value: 5, label: '出生', color: '#ffd32a' },
]

let map: mapboxgl.Map | null = null
let hoveredFeatureId: string | number | null = null

const drawerVisible = ref(false)
const isSubmitting = ref(false)
const selectedLabel = ref('')
const currentMode = ref<'COUNTRY' | 'PROVINCE' | 'CITY' | 'CORNER'>('COUNTRY')

// 数据仓库
const savedState = reactive({
  COUNTRY: {} as Record<string, string>,
  PROVINCE: {} as Record<string, string>,
  CITY: {} as Record<string, string>
})

const STORAGE_KEYS = { DATA: 'trazure_data_v12_optimized' }

const targetInfo = reactive({
  id: null as number | string | null,
  name: '',
  lng: 0,
  lat: 0
})

const form = reactive({ category: 4, mood: '' })

// --- 工具：安全设置图层可见性 ---
const setLayerVisibility = (layerIds: string[], isVisible: boolean) => {
  if (!map || !map.getStyle()) return
  layerIds.forEach(id => {
    if (map!.getLayer(id)) {
      map!.setLayoutProperty(id, 'visibility', isVisible ? 'visible' : 'none')
    }
  })
}

// --- 核心：模式切换 ---
const updateLayerVisibility = () => {
  if (!map) return
  const mode = currentMode.value

  // 定义各模式关联的图层 ID 组
  const groups = {
    COUNTRY: ['layer-admin0-fill', 'layer-admin0-line'],
    PROVINCE: ['layer-admin1-fill', 'layer-admin1-line'],
    // 🏙️ 城市模式现在关联全球城市图层
    CITY: ['layer-admin2-fill', 'layer-admin2-line'],
    CORNER: []
  }

  // 1. 先全部隐藏
  Object.values(groups).flat().forEach(id => {
    if (map!.getLayer(id)) map!.setLayoutProperty(id, 'visibility', 'none')
  })

  // 2. 再显示当前模式
  // @ts-ignore
  const activeLayers = groups[mode] || []
  setLayerVisibility(activeLayers, true)
}

const switchMode = (mode: 'COUNTRY' | 'PROVINCE' | 'CITY' | 'CORNER') => {
  currentMode.value = mode
  updateLayerVisibility()

  // 3D 视角运镜
  if (mode === 'COUNTRY') map!.flyTo({ zoom: 2.5, pitch: 0 })
  else if (mode === 'PROVINCE') map!.flyTo({ zoom: 4, pitch: 0 })
  else if (mode === 'CITY') map!.flyTo({ zoom: 8, pitch: 45 }) // 城市视角
  else map!.flyTo({ zoom: 14, pitch: 60 })
}

// --- 数据持久化与恢复 ---
const saveToStorage = () => localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(savedState))

const loadFromStorage = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DATA)
    if (data) Object.assign(savedState, JSON.parse(data))
  } catch(e) {}
}

const restoreFeatureState = () => {
  if (!map || !map.isStyleLoaded()) return

  // 恢复国家
  Object.entries(savedState.COUNTRY).forEach(([id, color]) => {
    map!.setFeatureState(
      { source: CONFIG.COUNTRY.SOURCE_ID, sourceLayer: CONFIG.COUNTRY.LAYER_NAME, id: id },
      { occupied: true, color: color }
    )
  })
  // 恢复省份
  Object.entries(savedState.PROVINCE).forEach(([id, color]) => {
    map!.setFeatureState(
      { source: CONFIG.PROVINCE.SOURCE_ID, sourceLayer: CONFIG.PROVINCE.LAYER_NAME, id: id },
      { occupied: true, color: color }
    )
  })
  // 恢复城市
  Object.entries(savedState.CITY).forEach(([id, color]) => {
    map!.setFeatureState(
      { source: CONFIG.CITY.SOURCE_ID, sourceLayer: CONFIG.CITY.LAYER_NAME, id: id },
      { occupied: true, color: color }
    )
  })
}

// --- 提交逻辑 ---
const handleSubmit = async () => {
  if (!map) return
  isSubmitting.value = true
  const color = CATEGORY_STYLES.find(c => c.value === form.category)!.color

  setTimeout(() => {
    const id = targetInfo.id as string

    // 1. 国家模式
    if (currentMode.value === 'COUNTRY' && id) {
      savedState.COUNTRY[id] = color
      map!.setFeatureState(
        { source: CONFIG.COUNTRY.SOURCE_ID, sourceLayer: CONFIG.COUNTRY.LAYER_NAME, id: id },
        { occupied: true, color: color }
      )
      ElMessage.success(`国家点亮：${targetInfo.name}`)
    }
    // 2. 省份模式
    else if (currentMode.value === 'PROVINCE' && id) {
      savedState.PROVINCE[id] = color
      map!.setFeatureState(
        { source: CONFIG.PROVINCE.SOURCE_ID, sourceLayer: CONFIG.PROVINCE.LAYER_NAME, id: id },
        { occupied: true, color: color }
      )
      ElMessage.success(`省份点亮：${targetInfo.name}`)
    }
    // 3. 城市模式 (全球)
    else if (currentMode.value === 'CITY' && id) {
      savedState.CITY[id] = color
      map!.setFeatureState(
        { source: CONFIG.CITY.SOURCE_ID, sourceLayer: CONFIG.CITY.LAYER_NAME, id: id },
        { occupied: true, color: color }
      )
      ElMessage.success(`城市点亮：${targetInfo.name}`)
    }
    // 4. 角落
    else {
      const el = document.createElement('div')
      el.className = 'corner-pin'
      el.style.borderColor = color
      el.innerHTML = `<div class="pin-head" style="background:${color}"></div>`
      new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([targetInfo.lng, targetInfo.lat]).addTo(map!)
      ElMessage.success(`坐标已标记`)
    }

    saveToStorage()
    isSubmitting.value = false
    drawerVisible.value = false
  }, 300)
}

// --- 通用图层添加函数 (DRY原则) ---
const addVectorLayer = (type: 'COUNTRY' | 'PROVINCE' | 'CITY') => {
  const cfg = CONFIG[type]

  // 映射 ID 前缀：COUNTRY->admin0, PROVINCE->admin1, CITY->admin2
  let layerPrefix = 'layer-admin0'
  if (type === 'PROVINCE') layerPrefix = 'layer-admin1'
  if (type === 'CITY') layerPrefix = 'layer-admin2'

  // 添加源
  if (!map!.getSource(cfg.SOURCE_ID)) {
    map!.addSource(cfg.SOURCE_ID, {
      type: 'vector',
      url: cfg.URL,
      promoteId: cfg.PROMOTE_ID
    })
  }

  // 填充层 (Fill)
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

  // 轮廓层 (Line)
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
  loadFromStorage()

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

    // 3. 加载自定义瓦片
    addVectorLayer('COUNTRY')
    addVectorLayer('PROVINCE')
    addVectorLayer('CITY') // 👈 这一行现在会加载全球城市数据

    // 4. 初始化图层状态
    updateLayerVisibility()
    restoreFeatureState()
  })

  // --- 统一交互处理 ---
  const handleInteraction = (e: mapboxgl.MapMouseEvent, isClick: boolean) => {
    let type: 'COUNTRY' | 'PROVINCE' | 'CITY' | null = null
    if (currentMode.value === 'COUNTRY') type = 'COUNTRY'
    else if (currentMode.value === 'PROVINCE') type = 'PROVINCE'
    else if (currentMode.value === 'CITY') type = 'CITY' // 允许城市模式

    // 角落模式不走瓦片交互
    if (!type) {
      if (isClick) {
        targetInfo.lng = e.lngLat.lng
        targetInfo.lat = e.lngLat.lat
        selectedLabel.value = '角落'
        drawerVisible.value = true
      }
      return
    }

    const cfg = CONFIG[type]
    // 映射图层名
    let layerId = 'layer-admin0-fill'
    if (type === 'PROVINCE') layerId = 'layer-admin1-fill'
    if (type === 'CITY') layerId = 'layer-admin2-fill'

    const features = map!.queryRenderedFeatures(e.point, { layers: [layerId] })

    if (features.length > 0) {
      map!.getCanvas().style.cursor = 'pointer'
      const feat = features[0]
      const id = feat.id as string

      // 悬停逻辑
      if (!isClick) {
        if (hoveredFeatureId !== id) {
          if (hoveredFeatureId) map!.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: false })
          hoveredFeatureId = id
          map!.setFeatureState({ source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: hoveredFeatureId }, { hover: true })
        }
      }
      // 点击逻辑
      else {
        targetInfo.id = id
        targetInfo.name = id
        targetInfo.lng = e.lngLat.lng
        targetInfo.lat = e.lngLat.lat
        selectedLabel.value = id
        drawerVisible.value = true
      }
    } else {
      map!.getCanvas().style.cursor = ''
      // 如果点击了空白处 (特别是城市模式)，允许点选坐标 (Fallback)
      if (isClick && type === 'CITY') {
        targetInfo.lng = e.lngLat.lng
        targetInfo.lat = e.lngLat.lat
        selectedLabel.value = '未知区域 (无边界)'
        targetInfo.id = null // 清空 ID，走普通 Pin 逻辑
        drawerVisible.value = true
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
    <div id="map-container"></div>

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

    <el-drawer v-model="drawerVisible" :title="selectedLabel" size="320px" class="custom-drawer">
      <div class="drawer-content">
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

          <el-form-item label="心情">
            <el-input v-model="form.mood" type="textarea" placeholder="写下这一刻..." />
          </el-form-item>

          <el-button type="primary" class="glow-btn" @click="handleSubmit" :loading="isSubmitting"
                     :style="{ background: CATEGORY_STYLES.find(c=>c.value===form.category)?.color }">
            {{ isSubmitting ? '点亮中...' : '确认点亮' }}
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
.custom-drawer .el-drawer__header { color: #fff; background: #111; margin: 0; padding: 20px; }
.color-options { display: flex; gap: 12px; margin-bottom: 5px; }
.color-circle { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; transition: transform 0.2s;}
.color-circle:hover { transform: scale(1.2); }
.color-label { font-size: 14px; font-weight: bold; margin-top: 8px; }
.glow-btn { width: 100%; border: none; font-weight: bold; color: #000; height: 42px; margin-top: 20px; border-radius: 8px; }
</style>

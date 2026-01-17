<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import axios from 'axios'

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

const CATEGORY_STYLES = [
  { value: 1, label: '旅游', color: '#00ffc8' },
  { value: 2, label: '留学', color: '#00a8ff' },
  { value: 3, label: '定居', color: '#ff9f43' },
  { value: 4, label: '恋爱', color: '#ff5252' },
  { value: 5, label: '出生', color: '#ffd32a' },
]

const api = axios.create({
  baseURL: 'http://localhost:8080',
  withCredentials: true
})

let map: mapboxgl.Map | null = null
let hoveredFeatureId: string | number | null = null

const drawerVisible = ref(false)
const isSubmitting = ref(false)
const selectedLabel = ref('')
const currentMode = ref<'COUNTRY' | 'PROVINCE' | 'CITY' | 'CORNER'>('COUNTRY')

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

const loadFootprints = async () => {
  try {
    const res = await api.get('/footprints/list')
    const footprints = res.data
    footprints.forEach((fp: any) => {
      let cfg = CONFIG.CITY
      if (fp.layerType === 'COUNTRY') cfg = CONFIG.COUNTRY
      else if (fp.layerType === 'PROVINCE') cfg = CONFIG.PROVINCE

      const style = CATEGORY_STYLES.find(c => c.value === fp.category)
      const color = style ? style.color : '#ffffff'

      if (fp.regionId && map && map.getSource(cfg.SOURCE_ID)) {
        if (map.isSourceLoaded(cfg.SOURCE_ID)) {
          map.setFeatureState(
            { source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: fp.regionId },
            { occupied: true, color: color }
          )
        } else {
          map.once('sourcedata', () => {
            map!.setFeatureState(
              { source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: fp.regionId },
              { occupied: true, color: color }
            )
          })
        }
      }
    })
    console.log('✅ 已从云端加载足迹:', footprints.length)
  } catch (error) {
    console.error('加载足迹失败:', error)
  }
}

const handleSubmit = async () => {
  if (!map) return
  isSubmitting.value = true
  const finalRegionId = targetInfo.id || `CORNER_${Date.now()}_${Math.floor(Math.random()*1000)}`

  const footprintData = {
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

  try {
    await api.post('/footprints/light-up', footprintData)
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

    // 🏗️ 修复2：添加 3D 建筑图层
    // 这会让地图上的楼房在放大时立起来
    if (!map!.getLayer('3d-buildings')) {
      map!.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      })
    }

    addVectorLayer('COUNTRY')
    addVectorLayer('PROVINCE')
    addVectorLayer('CITY')

    updateLayerVisibility()
    loadFootprints()
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

          <el-form-item label="详细故事">
            <el-input v-model="form.description" type="textarea" rows="3" placeholder="Markdown 格式日记..." />
          </el-form-item>

          <el-button type="primary" class="glow-btn" @click="handleSubmit" :loading="isSubmitting"
                     :style="{ background: CATEGORY_STYLES.find(c=>c.value===form.category)?.color }">
            {{ isSubmitting ? '同步中...' : '确认点亮 ✨' }}
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

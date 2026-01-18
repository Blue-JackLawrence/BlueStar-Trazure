import { ref, shallowRef } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// 你的 Mapbox Token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// 静态配置 (从原文件移动过来，并在最后 export 出去)
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

export function useMapbox() {
  // 使用 shallowRef 优化 Mapbox 实例性能
  const map = shallowRef<mapboxgl.Map | null>(null)
  const currentMode = ref<'COUNTRY' | 'PROVINCE' | 'CITY' | 'CORNER'>('COUNTRY')

  // 初始化地图
  const initMap = (containerId: string, onLoadCallback: () => void) => {
    map.value = new mapboxgl.Map({
      container: containerId,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'globe' as any,
      center: [105, 35],
      zoom: 2.5,
      pitch: 0,
    })

    map.value.on('style.load', () => {
      const m = map.value!
      // 1. 基础特效
      m.setFog({ color: 'rgb(10, 10, 20)', 'high-color': 'rgb(0, 0, 0)', 'space-color': 'rgb(0, 0, 0)', 'star-intensity': 1.0 })
      m.addSource('mapbox-dem', { 'type': 'raster-dem', 'url': 'mapbox://mapbox.mapbox-terrain-dem-v1', 'tileSize': 512, 'maxzoom': 14 })
      m.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 })

      // 2. 3D 建筑 (原代码逻辑)
      if (!m.getLayer('3d-buildings')) {
        const layers = m.getStyle().layers;
        let labelLayerId;
        for (const layer of layers) {
          if (layer.type === 'symbol' && layer.layout['text-field']) {
            labelLayerId = layer.id;
            break;
          }
        }
        m.addLayer({
          'id': '3d-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 14,
          'paint': {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']],
            'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'min_height']],
            'fill-extrusion-opacity': 0.6
          }
        }, labelLayerId)
      }

      // 3. 添加三个矢量图层
      addVectorLayer('COUNTRY')
      addVectorLayer('PROVINCE')
      addVectorLayer('CITY')

      updateLayerVisibility()

      // 4. 回调：通知 HomeView 地图好了，可以加载足迹了
      onLoadCallback()
    })
  }

  // 内部辅助：添加图层
  const addVectorLayer = (type: 'COUNTRY' | 'PROVINCE' | 'CITY') => {
    const m = map.value
    if (!m) return
    const cfg = CONFIG[type]
    let layerPrefix = 'layer-admin0'
    if (type === 'PROVINCE') layerPrefix = 'layer-admin1'
    if (type === 'CITY') layerPrefix = 'layer-admin2'

    if (!m.getSource(cfg.SOURCE_ID)) {
      m.addSource(cfg.SOURCE_ID, { type: 'vector', url: cfg.URL, promoteId: cfg.PROMOTE_ID })
    }

    // Fill Layer
    m.addLayer({
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

    // Line Layer
    m.addLayer({
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

  // 切换模式 (UI绑定用)
  const switchMode = (mode: 'COUNTRY' | 'PROVINCE' | 'CITY' | 'CORNER') => {
    currentMode.value = mode
    updateLayerVisibility()
    const m = map.value!
    if (mode === 'COUNTRY') m.flyTo({ zoom: 2.5, pitch: 0 })
    else if (mode === 'PROVINCE') m.flyTo({ zoom: 4, pitch: 0 })
    else if (mode === 'CITY') m.flyTo({ zoom: 8, pitch: 45 })
    else m.flyTo({ zoom: 14, pitch: 60 })
  }

  // 更新可见性
  const updateLayerVisibility = () => {
    const m = map.value
    if (!m) return
    const groups = {
      COUNTRY: ['layer-admin0-fill', 'layer-admin0-line'],
      PROVINCE: ['layer-admin1-fill', 'layer-admin1-line'],
      CITY: ['layer-admin2-fill', 'layer-admin2-line'],
      CORNER: []
    }
    Object.values(groups).flat().forEach(id => {
      if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', 'none')
    })
    const active = groups[currentMode.value] || []
    active.forEach(id => {
      if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', 'visible')
    })
  }

  // 高亮某个区域 (加载足迹时调用)
  const highlightRegion = (regionId: string, layerType: string, color: string) => {
    const m = map.value
    if (!m) return

    let cfg = CONFIG.CITY
    if (layerType === 'COUNTRY') cfg = CONFIG.COUNTRY
    else if (layerType === 'PROVINCE') cfg = CONFIG.PROVINCE

    if (m.getSource(cfg.SOURCE_ID)) {
      const setJson = () => m.setFeatureState(
        { source: cfg.SOURCE_ID, sourceLayer: cfg.LAYER_NAME, id: regionId },
        { occupied: true, color: color }
      )
      if (m.isSourceLoaded(cfg.SOURCE_ID)) setJson()
      else m.once('sourcedata', setJson)
    }
  }

  // 添加角落标记 (UI绑定用)
  const addCornerMarker = (lng: number, lat: number, color: string) => {
    const el = document.createElement('div')
    el.className = 'corner-pin'
    el.style.borderColor = color
    el.innerHTML = `<div class="pin-head" style="background:${color}"></div>`
    new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map.value!)
  }

  return {
    map,
    currentMode,
    CONFIG, // 导出给 View 用
    initMap,
    switchMode,
    highlightRegion,
    addCornerMarker
  }
}

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import L from 'leaflet'
import axios from 'axios'
import { ElMessage } from 'element-plus' // 引入漂亮的消息提示

// --- 地图相关变量 ---
let map: L.Map | null = null
// 临时存储当前点击的经纬度
const currentLatLng = ref<{ lat: number; lng: number } | null>(null)

// --- UI 控制变量 ---
const drawerVisible = ref(false) // 控制抽屉是否显示
const isSubmitting = ref(false)  // 控制按钮是否在转圈圈

// --- 表单数据 ---
const form = reactive({
  mood: '',
  locationName: ''
})

// --- 方法：加载所有足迹 ---
const loadFootprints = async () => {
  try {
    const res = await axios.get('http://localhost:8080/footprints')
    const footprints = res.data

    // 清除旧标记（这里简化处理，直接加新的）
    footprints.forEach((fp: any) => {
      // 在地图上添加一个小标记
      L.marker([fp.latitude, fp.longitude])
        .addTo(map!)
        .bindPopup(`
           <div style="font-size: 14px; color: #333;">
             <strong>${fp.mood}</strong> <br>
             <span style="color: #666; font-size: 12px;">${fp.locationName || '未知地点'}</span>
           </div>
        `)
    })
  } catch (e) {
    console.error("加载失败", e)
  }
}

// --- 方法：提交新足迹 ---
const handleSubmit = async () => {
  if (!currentLatLng.value) return
  if (!form.mood) {
    ElMessage.warning('心情不能为空哦！')
    return
  }

  isSubmitting.value = true // 按钮开始转圈

  const newFootprint = {
    latitude: currentLatLng.value.lat,
    longitude: currentLatLng.value.lng,
    mood: form.mood,
    locationName: form.locationName || '未知荒野', // 如果没填就默认这个
  }

  try {
    // 1. 发送给后端
    await axios.post('http://localhost:8080/footprints', newFootprint)

    // 2. 成功后的处理
    ElMessage.success('足迹记录成功！') // 弹出绿色成功框
    drawerVisible.value = false       // 关闭抽屉

    // 3. 在地图上补一个钉子
    L.marker([newFootprint.latitude, newFootprint.longitude])
      .addTo(map!)
      .bindPopup(`<b>${newFootprint.mood}</b><br>刚刚添加`)
      .openPopup()

    // 4. 重置表单
    form.mood = ''
    form.locationName = ''

  } catch (error) {
    ElMessage.error('保存失败，请检查后端服务')
  } finally {
    isSubmitting.value = false // 按钮停止转圈
  }
}

// --- 生命周期 ---
onMounted(() => {
  // 初始化地图
  map = L.map('map-container', { zoomControl: false }).setView([-33.8568, 151.2153], 13)

  // 把缩放控件放到右下角，防止被左边的抽屉挡住
  L.control.zoom({ position: 'bottomright' }).addTo(map)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map)

  loadFootprints()

  // 核心改动：点击地图 -> 打开 Element Plus 抽屉
  map.on('click', (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng
    currentLatLng.value = { lat, lng } // 记下坐标
    drawerVisible.value = true         // 打开抽屉
  })
})
</script>

<template>
  <div class="page-container">

    <div id="map-container"></div>

    <el-drawer
      v-model="drawerVisible"
      title="记录新足迹"
      direction="rtl"
      size="320px"
    >
      <div class="drawer-content">
        <p class="tips">你点击了坐标: <br> {{ currentLatLng?.lat.toFixed(4) }}, {{ currentLatLng?.lng.toFixed(4) }}</p>

        <el-form label-position="top">
          <el-form-item label="此刻心情">
            <el-input
              v-model="form.mood"
              placeholder="开心？难过？还是..."
              type="textarea"
              :rows="3"
            />
          </el-form-item>

          <el-form-item label="地点名称">
            <el-input
              v-model="form.locationName"
              placeholder="例如：悉尼歌剧院"
              prefix-icon="Location"
            />
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              class="submit-btn"
              @click="handleSubmit"
              :loading="isSubmitting"
            >
              点亮足迹
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-drawer>

  </div>
</template>

<style scoped>
.page-container {
  width: 100%;
  height: 100vh;
  position: relative;
}

#map-container {
  width: 100%;
  height: 100%;
  z-index: 1; /* 地图在底层 */
}

/* 让抽屉里的内容好看点 */
.drawer-content {
  padding: 10px;
}
.tips {
  color: #909399;
  font-size: 13px;
  margin-bottom: 20px;
  background: #f4f4f5;
  padding: 10px;
  border-radius: 4px;
}
.submit-btn {
  width: 100%;
  margin-top: 20px;
  height: 40px;
  font-size: 16px;
}
</style>

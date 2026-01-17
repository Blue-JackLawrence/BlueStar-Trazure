import 'mapbox-gl/dist/mapbox-gl.css' // <-- 加上这行
import 'element-plus/dist/index.css' // <--- New: 引入 Element Plus 的样式文件

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus' // <--- New: 引入组件库核心
import * as ElementPlusIconsVue from '@element-plus/icons-vue' // <--- New: 引入所有图标

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus) // <--- New: 告诉 Vue 使用它

// 注册所有图标 (方便以后随便用)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')

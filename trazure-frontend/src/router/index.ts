import { createRouter, createWebHistory } from 'vue-router'
// 关键：确保这里引用了你手动创建的 HomeView
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    }
  ]
})

export default router

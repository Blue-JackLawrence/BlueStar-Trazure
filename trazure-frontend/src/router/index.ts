import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import UserView from '../views/UserView.vue'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/user', name: 'user', component: UserView },
  ]
})

// 🛡️ 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  // 初始化用户状态 (防止刷新丢失)
  userStore.initUser()

  if (to.name !== 'login' && !userStore.isLogin) {
    next({ name: 'login' }) // 没登录？去登录页
  } else {
    next()
  }
})

export default router

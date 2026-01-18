// src/stores/user.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  // 状态：当前用户信息
  const userInfo = ref({
    id: null as number | null,
    username: '',
    email: '',
    isPaid: 0
  })

  // 状态：是否已登录
  const isLogin = ref(false)

  // 动作：登录
  const login = (user: any) => {
    userInfo.value = user
    isLogin.value = true
    // 持久化到 localStorage (刷新页面不丢失登录状态)
    localStorage.setItem('trazure_user', JSON.stringify(user))
  }

  // 动作：登出
  const logout = () => {
    userInfo.value = { id: null, username: '', email: '', isPaid: 0 }
    isLogin.value = false
    localStorage.removeItem('trazure_user')
  }

  // 动作：初始化 (每次刷新页面时调用)
  const initUser = () => {
    const stored = localStorage.getItem('trazure_user')
    if (stored) {
      userInfo.value = JSON.parse(stored)
      isLogin.value = true
    }
  }

  return { userInfo, isLogin, login, logout, initUser }
})

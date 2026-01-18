<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const userStore = useUserStore()

const isRegister = ref(false) // 切换登录/注册
const form = reactive({
  username: '',
  password: '',
  email: ''
})

const handleLogin = async () => {
  if(!form.username || !form.password) return ElMessage.warning('请输入完整')

  try {
    // 调用后端接口
    const res = await axios.post('http://localhost:8080/user/login', {
      username: form.username,
      password: form.password
    })

    if(res.data.code === 200) {
      ElMessage.success('欢迎回来, 指挥官 ' + res.data.data.username)
      // 存入 Pinia
      userStore.login(res.data.data)
      // 跳转首页
      router.push('/')
    } else {
      ElMessage.error(res.data.msg)
    }
  } catch(e) {
    ElMessage.error('连接服务器失败')
  }
}

const handleRegister = async () => {
  // ... 注册逻辑类似，调用 /user/register ...
  // 为了节省篇幅，此处省略，逻辑同上
  ElMessage.info('注册功能开发中，请使用账号: Jack Lawrence / 密码: 123456')
}
</script>

<template>
  <div class="login-container">
    <div class="login-box">
      <h1>🌏 TRAZURE</h1>
      <p class="subtitle">记录你的星球足迹</p>

      <div class="input-group">
        <input v-model="form.username" type="text" placeholder="指挥官代号 (Username)" />
        <input v-model="form.password" type="password" placeholder="访问密钥 (Password)" />
      </div>

      <button class="login-btn" @click="handleLogin">
        {{ isRegister ? '注册档案' : '接入系统' }}
      </button>

      <div class="toggle-link" @click="isRegister = !isRegister">
        {{ isRegister ? '已有账号？去登录' : '新用户？创建档案' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  width: 100vw;
  height: 100vh;
  background: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  /* 这里可以加一个星空背景图 */
  background-image: radial-gradient(circle at center, #1a1a2e 0%, #000 100%);
}

.login-box {
  width: 360px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
  color: #fff;
}

h1 { letter-spacing: 4px; margin-bottom: 10px; background: linear-gradient(to right, #00ffc8, #00a8ff); -webkit-background-clip: text; color: transparent; }
.subtitle { color: #888; font-size: 12px; margin-bottom: 30px; }

.input-group input {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  background: #222;
  border: 1px solid #333;
  color: #fff;
  border-radius: 4px;
  outline: none;
}
.input-group input:focus { border-color: #00ffc8; }

.login-btn {
  width: 100%;
  padding: 12px;
  background: #00ffc8;
  color: #000;
  font-weight: bold;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
  transition: all 0.3s;
}
.login-btn:hover { background: #00a8ff; box-shadow: 0 0 15px rgba(0, 168, 255, 0.4); }

.toggle-link { margin-top: 20px; font-size: 12px; color: #666; cursor: pointer; }
.toggle-link:hover { color: #fff; }
</style>

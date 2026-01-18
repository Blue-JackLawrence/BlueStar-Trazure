<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, SwitchButton, Trophy, User as UserIcon } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

// 返回地球 (地图页)
const goBack = () => router.push('/')

// 退出登录
const handleLogout = () => {
  ElMessageBox.confirm(
    '确定要切断与蓝星系统的连接吗？',
    '正在登出',
    {
      confirmButtonText: '确认登出',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'cyber-message-box' // 后面可以在全局样式加点特效
    }
  ).then(() => {
    userStore.logout()
    router.push('/login')
    ElMessage.success('已安全下线')
  }).catch(() => {})
}
</script>

<template>
  <div class="user-page">
    <div class="nav-header">
      <div class="back-btn" @click="goBack">
        <el-icon><Back /></el-icon> 返回星图
      </div>
    </div>

    <div class="profile-card">
      <div class="avatar-section">
        <div class="avatar-ring">
          <el-icon v-if="!userInfo.avatar" :size="40" color="#00ffc8"><UserIcon /></el-icon>
          <img v-else :src="userInfo.avatar" class="real-avatar" />
        </div>
        <div class="status-badge" :class="{ 'vip': userInfo.isPaid }">
          {{ userInfo.isPaid ? 'PRO 指挥官' : '实习驾驶员' }}
        </div>
      </div>

      <div class="info-section">
        <h2 class="username">{{ userInfo.username || '未知指挥官' }}</h2>
        <p class="email">ID: {{ userInfo.id }} | {{ userInfo.email || '未绑定邮箱' }}</p>

        <div class="stats-row">
          <div class="stat-item">
            <div class="num">12</div>
            <div class="label">足迹</div>
          </div>
          <div class="stat-item">
            <div class="num">3</div>
            <div class="label">国家</div>
          </div>
          <div class="stat-item">
            <div class="num">46</div>
            <div class="label">照片</div>
          </div>
        </div>
      </div>

      <div class="action-section">
        <div class="menu-item">
          <el-icon><Trophy /></el-icon>
          <span>我的成就 (开发中)</span>
        </div>

        <div class="menu-item logout" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          <span>退出登录</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-page {
  width: 100vw;
  height: 100vh;
  background: #000;
  background-image: radial-gradient(circle at 50% 30%, #1a1a2e 0%, #000 70%);
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
}

.nav-header {
  width: 100%;
  padding: 20px;
  display: flex;
  justify-content: flex-start;
}
.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #888;
  transition: color 0.3s;
}
.back-btn:hover { color: #00ffc8; }

.profile-card {
  margin-top: 60px;
  width: 380px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 40px 30px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

.avatar-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid #00ffc8;
  margin: 0 auto 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 255, 200, 0.1);
  box-shadow: 0 0 20px rgba(0, 255, 200, 0.2);
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  background: #333;
  color: #aaa;
  margin-bottom: 20px;
}
.status-badge.vip {
  background: linear-gradient(90deg, #ffd32a, #ffa502);
  color: #000;
  font-weight: bold;
}

.username { font-size: 24px; margin: 0 0 5px; letter-spacing: 1px; }
.email { font-size: 12px; color: #666; margin: 0 0 30px; font-family: monospace; }

.stats-row {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30px;
  border-top: 1px solid rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding: 20px 0;
}
.stat-item .num { font-size: 20px; font-weight: bold; color: #fff; }
.stat-item .label { font-size: 12px; color: #666; margin-top: 4px; }

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.menu-item:hover { background: rgba(255,255,255,0.1); }
.menu-item.logout { color: #ff5252; background: rgba(255, 82, 82, 0.05); }
.menu-item.logout:hover { background: rgba(255, 82, 82, 0.15); }
</style>

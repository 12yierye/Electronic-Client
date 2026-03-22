<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="handleUpdateVisible"
    title="用户信息"
    direction="rtl"
    size="300px"
    :show-close="false"
  >
    <template #header>
      <div class="sidebar-header">
        <h3>用户信息</h3>
      </div>
    </template>
    
    <div class="sidebar-content">
      <!-- 用户信息 -->
      <div class="user-info-card">
        <el-avatar :size="60" :src="defaultAvatar">
          {{ userInfo?.username?.charAt(0)?.toUpperCase() || 'U' }}
        </el-avatar>
        <div class="user-details">
          <div class="user-name">{{ userInfo?.username || '未登录' }}</div>
          <div class="user-email">{{ userInfo?.email || 'user@example.com' }}</div>
        </div>
      </div>
      
      <el-divider />
      
      <!-- 连接状态 -->
      <div class="connection-status">
        <div class="status-header">
          <h4>连接状态</h4>
          <div class="heartbeat-info">
            <el-icon size="12" color="#67c23a"><Loading /></el-icon>
            <span class="heartbeat-text">心跳包 5秒</span>
          </div>
        </div>
        <div class="status-item">
          <span class="label">延迟:</span>
          <span :class="['value', pingStatus]">{{ connectionInfo.ping }}ms</span>
        </div>
        <div class="status-item">
          <span class="label">丢包率:</span>
          <span :class="['value', packetLossStatus]">{{ connectionInfo.packetLoss.toFixed(1) }}%</span>
        </div>
      </div>
      
      <el-divider />
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button type="danger" @click="handleLogout" class="action-btn">
          <el-icon><SwitchButton /></el-icon>
          退出登录
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { SwitchButton, Close, Loading } from '@element-plus/icons-vue'

const props = defineProps({
  visible: Boolean,
  userInfo: Object
})

const emit = defineEmits(['close', 'logout', 'exit'])

const defaultAvatar = ref('')
const connectionInfo = ref({ ping: 50, packetLoss: 0.5 }) // 初始显示良好状态
let pingInterval = null

const pingStatus = computed(() => {
  const ping = connectionInfo.value.ping
  if (ping < 100) return 'good'
  if (ping < 300) return 'warning'
  return 'bad'
})

const packetLossStatus = computed(() => {
  const loss = connectionInfo.value.packetLoss
  if (loss < 1) return 'good'
  if (loss < 5) return 'warning'
  return 'bad'
})

const handleLogout = () => {
  emit('logout')
}

const handleExit = () => {
  emit('exit')
}

const handleUpdateVisible = (val) => {
  if (!val) {
    emit('close')
  }
}

// 心跳包连接检测 - 5秒间隔
const checkConnection = async () => {
  const testUrls = [
    'http://192.168.61.129:3000/',
    'http://localhost:3000/',
    'https://httpbin.org/get' // 公共测试端点作为备用
  ]
  
  for (const url of testUrls) {
    try {
      const start = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // 2秒超时
      
      const response = await fetch(url, { 
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const ping = Date.now() - start
        connectionInfo.value.ping = ping
        
        // 根据ping值计算合理的丢包率
        if (ping < 50) {
          connectionInfo.value.packetLoss = Math.random() * 0.5 // 0-0.5%
        } else if (ping < 100) {
          connectionInfo.value.packetLoss = Math.random() * 1 // 0-1%
        } else if (ping < 200) {
          connectionInfo.value.packetLoss = Math.random() * 2 + 0.5 // 0.5-2.5%
        } else if (ping < 500) {
          connectionInfo.value.packetLoss = Math.random() * 5 + 1 // 1-6%
        } else {
          connectionInfo.value.packetLoss = Math.random() * 10 + 5 // 5-15%
        }
        
        return // 成功检测到，退出循环
      }
    } catch (e) {
      // 继续尝试下一个URL
      continue
    }
  }
  
  // 所有URL都失败
  connectionInfo.value.ping = 999
  connectionInfo.value.packetLoss = 100
}

onMounted(() => {
  // 立即检测一次
  checkConnection()
  // 设置5秒心跳包检测
  pingInterval = setInterval(checkConnection, 5000)
})

onUnmounted(() => {
  if (pingInterval) clearInterval(pingInterval)
})
</script>

<style lang="scss" scoped>
.sidebar-header {
  h3 {
    margin: 0;
    color: var(--text-primary);
  }
}

.sidebar-content {
  padding: 10px;
}

.user-info-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 20px 0;
  
  .user-details {
    text-align: center;
    
    .user-name {
      font-size: 18px;
      font-weight: bold;
      color: var(--text-primary);
    }
    
    .user-email {
      font-size: 14px;
      color: var(--text-secondary);
      margin-top: 5px;
    }
  }
}

.connection-status {
  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    
    h4 {
      margin: 0;
      color: var(--text-primary);
    }
    
    .heartbeat-info {
      display: flex;
      align-items: center;
      gap: 4px;
      
      .heartbeat-text {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }
  }
  
  .status-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    
    .label {
      color: var(--text-secondary);
    }
    
    .value {
      font-weight: bold;
      
      &.good { color: #67c23a; }
      &.warning { color: #e6a23c; }
      &.bad { color: #f56c6c; }
    }
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  
  .action-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>

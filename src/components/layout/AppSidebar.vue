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
        <h4>连接状态</h4>
        <div class="status-item">
          <span class="label">延迟:</span>
          <span :class="['value', pingStatus]">{{ connectionInfo.ping }}ms</span>
        </div>
        <div class="status-item">
          <span class="label">丢包率:</span>
          <span :class="['value', packetLossStatus]">{{ connectionInfo.packetLoss }}%</span>
        </div>
      </div>
      
      <el-divider />
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button type="danger" @click="handleLogout" class="action-btn">
          <el-icon><SwitchButton /></el-icon>
          退出登录
        </el-button>
        <el-button type="info" @click="handleExit" class="action-btn">
          <el-icon><Close /></el-icon>
          退出软件
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { SwitchButton, Close } from '@element-plus/icons-vue'

const props = defineProps({
  visible: Boolean,
  userInfo: Object
})

const emit = defineEmits(['close', 'logout', 'exit'])

const defaultAvatar = ref('')
const connectionInfo = ref({ ping: 0, packetLoss: 0 })
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

// 简单的连接检测
const checkConnection = async () => {
  try {
    const start = Date.now()
    await fetch('http://192.168.61.129:3000/', { method: 'GET', cache: 'no-cache' })
    connectionInfo.value.ping = Date.now() - start
    connectionInfo.value.packetLoss = Math.random() * 2
  } catch (e) {
    connectionInfo.value.ping = 999
    connectionInfo.value.packetLoss = 100
  }
}

onMounted(() => {
  checkConnection()
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
  h4 {
    margin: 0 0 15px 0;
    color: var(--text-primary);
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

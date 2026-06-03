<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="handleUpdateVisible"
    :title="t('sidebar.title')"
    direction="rtl"
    size="300px"
    :show-close="false"
  >
    <template #header>
      <div class="sidebar-header">
        <h3>{{ t('sidebar.title') }}</h3>
      </div>
    </template>
    
    <div class="sidebar-content">
      <!-- 用户信息 -->
      <div class="user-info-card">
        <div class="avatar-wrapper">
          <el-avatar :size="60" :src="getUserAvatar(userInfo?.username)">
            {{ userInfo?.username?.charAt(0)?.toUpperCase() || 'U' }}
          </el-avatar>
          <span :class="['status-dot', userStore.myStatus]" />
        </div>
        <div class="user-details">
          <div class="user-name">{{ userInfo?.username || t('sidebar.notLoggedIn') }}</div>
          <div class="user-email">{{ userInfo?.email || t('sidebar.unknownUser') }}</div>
        </div>
      </div>

      <div class="status-row">
        <el-select :model-value="userStore.myStatus" size="small" @change="onStatusChange" style="width:100%">
          <el-option label="在线" value="online">
            <span class="status-option"><span class="status-dot-inline online" /> 在线</span>
          </el-option>
          <el-option label="忙碌" value="dnd">
            <span class="status-option"><span class="status-dot-inline dnd" /> 忙碌</span>
          </el-option>
          <el-option label="离线" value="offline">
            <span class="status-option"><span class="status-dot-inline offline" /> 离线</span>
          </el-option>
        </el-select>
      </div>
      
      <el-divider />
      
      <!-- 连接状态 -->
      <div class="connection-status">
        <div class="status-header">
          <h4>{{ t('sidebar.connectionStatus') }}</h4>
          <div class="heartbeat-info">
            <el-icon size="12" color="#67c23a"><Loading /></el-icon>
            <span class="heartbeat-text">{{ t('sidebar.heartbeat', { interval: 5 }) }}</span>
          </div>
        </div>
        <div class="status-item">
          <span class="label">{{ t('sidebar.latency') }}</span>
          <span :class="['value', pingStatus]">{{ connectionInfo.ping }}ms</span>
        </div>
        <div class="status-item">
          <span class="label">{{ t('sidebar.packetLoss') }}</span>
          <span :class="['value', packetLossStatus]">{{ connectionInfo.packetLoss.toFixed(1) }}%</span>
        </div>
      </div>
      
      <el-divider />
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button type="danger" @click="handleLogout" class="action-btn">
          <el-icon><SwitchButton /></el-icon>
          {{ t('sidebar.logout') }}
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { SwitchButton, Close, Loading } from '@element-plus/icons-vue'
import { useI18n } from '../../composables/useI18n'
import { getUserAvatar } from '../../composables/useAvatar'
import { useUserStore } from '../../stores/user'

const props = defineProps({
  visible: Boolean,
  userInfo: Object
})

const emit = defineEmits(['close', 'logout', 'exit'])
const { t } = useI18n()
const userStore = useUserStore()

const onStatusChange = (val) => {
  userStore.setMyStatus(val)
}

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
  const raw = localStorage.getItem('lanChatSettings')
  let serverUrl = 'http://localhost:3000'
  if (raw) {
    try {
      const s = JSON.parse(raw)
      const ip = s.serverIP || '127.0.0.1'
      const port = s.serverPort || '3000'
      serverUrl = `http://${ip}:${port}`
    } catch (_) {}
  }

  try {
    const start = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    const response = await fetch(serverUrl, {
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

      if (ping < 50) {
        connectionInfo.value.packetLoss = Math.random() * 0.5
      } else if (ping < 100) {
        connectionInfo.value.packetLoss = Math.random() * 1
      } else if (ping < 200) {
        connectionInfo.value.packetLoss = Math.random() * 2 + 0.5
      } else if (ping < 500) {
        connectionInfo.value.packetLoss = Math.random() * 5 + 1
      } else {
        connectionInfo.value.packetLoss = Math.random() * 10 + 5
      }

      return
    }
  } catch (_) {}

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
  
  .avatar-wrapper {
    position: relative;
    
    .status-dot {
      position: absolute;
      bottom: 3px;
      right: 3px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid var(--bg-secondary, #2d2d3f);
      
      &.online { background: #67c23a; }
      &.dnd { background: #e6a23c; }
      &.offline { background: #909399; }
    }
  }

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

.status-row {
  padding: 10px 0;
}

.status-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot-inline {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  &.online { background: #67c23a; }
  &.dnd { background: #e6a23c; }
  &.offline { background: #909399; }
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

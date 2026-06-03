<template>
  <nav class="app-navigation">
    <!-- 左侧导航按钮 -->
    <div class="nav-left">
      <el-button
        v-for="item in navItems"
        :key="item.key"
        :class="['nav-btn', {
          active: currentView === item.key,
          'has-unread-flash': item.key === 'chat' && flashClass && currentView !== 'chat'
        }]"
        @click="handleNavigate(item.key)"
      >
        <el-badge v-if="item.key === 'chat' && unreadCount > 0" :value="unreadCount" :max="99" class="nav-badge">
          <el-icon><component :is="item.icon" /></el-icon>
        </el-badge>
        <el-icon v-else><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
      </el-button>
    </div>

    <!-- 右侧用户头像按钮 -->
    <div class="nav-right">
      <div class="user-avatar" @click="toggleSidebar">
        <el-avatar :size="36" :src="userAvatar">
          {{ userInitial }}
        </el-avatar>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { ChatDotRound, Files, Setting, MagicStick, User, Bell, FolderOpened } from '@element-plus/icons-vue'
import { useI18n } from '../../composables/useI18n'
import { useSettingsStore } from '../../stores/settings'
import { getUserAvatar, getAvatarUrl } from '../../composables/useAvatar'
import { chatTotalUnread, refreshTotalUnread, publicUserUnread, publicGroupUnread } from '../../composables/useChatRoom'

const props = defineProps({
  currentView: {
    type: String,
    default: 'ai'
  },
  userInfo: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['navigate', 'toggle-sidebar'])
const { t } = useI18n()
const settingsStore = useSettingsStore()

const hasUnread = ref(false)
const unreadCount = ref(0)
let navPollTimer = null

// 根据设置中的闪烁程度返回对应的 CSS 类名
const flashClass = computed(() => {
  if (!hasUnread.value) return ''
  return 'flash-' + settingsStore.navFlashIntensity
})

const navItems = computed(() => [
  { key: 'ai', icon: 'MagicStick', label: t('navigation.ai') },
  { key: 'chat', icon: 'ChatDotRound', label: t('navigation.chat') },
  { key: 'broadcast', icon: 'Bell', label: t('navigation.broadcast') },
  { key: 'library', icon: 'FolderOpened', label: '内容库' },
  { key: 'files', icon: 'Files', label: t('navigation.files') },
  { key: 'settings', icon: 'Setting', label: t('navigation.settings') }
])

const handleNavigate = (view) => {
  emit('navigate', view)
}

const toggleSidebar = () => {
  emit('toggle-sidebar')
}

// 用户头像相关计算属性
const userAvatar = computed(() => {
  return getAvatarUrl(props.userInfo?.avatar) || getUserAvatar(props.userInfo?.username) || ''
})

const userInitial = computed(() => {
  return props.userInfo?.username?.charAt(0)?.toUpperCase() || 'U'
})

// 从 localStorage 加载已读进度
function loadReadPoints(username) {
  if (!username) return {}
  try {
    const raw = localStorage.getItem('chat_readPoints_' + username)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// 独立轮询未读数（不依赖 ChatRoom 生命周期）
const pollUnreadFromServer = async () => {
  const raw = localStorage.getItem('userInfo')
  if (!raw || !window.electronAPI?.getUnreadCounts) return
  try {
    const { username } = JSON.parse(raw)
    // 传入真实的已读进度，确保服务端正确计算未读
    const rp = loadReadPoints(username)
    const result = await window.electronAPI.getUnreadCounts(username, rp)
    if (result.success) {
      // 更新模块级未读存储，确保与 ChatRoom 的数据一致
      publicUserUnread.value = { ...(result.conversations || {}) }
      publicGroupUnread.value = { ...(result.groups || {}) }
      refreshTotalUnread()
    }
  } catch {}
}

const startNavPolling = () => {
  pollUnreadFromServer()
  const loop = () => {
    navPollTimer = setTimeout(async () => {
      await pollUnreadFromServer()
      loop()
    }, 5000)
  }
  loop()
}

const stopNavPolling = () => {
  if (navPollTimer) {
    clearTimeout(navPollTimer)
    navPollTimer = null
  }
}

onMounted(() => {
  // 立即同步一次，确保初始值正确
  refreshTotalUnread()
  pollUnreadFromServer()
  // 监听来自 ChatRoom 的未读更新
  watch(chatTotalUnread, (val) => {
    hasUnread.value = val > 0
    unreadCount.value = val
  }, { immediate: true })
  // 独立轮询兜底（ChatRoom 未挂载时也能更新）
  startNavPolling()
})

onUnmounted(() => {
  stopNavPolling()
})
</script>

<style lang="scss" scoped>
.app-navigation {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-right {
  display: flex;
  align-items: center;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(52, 152, 219, 0.1);
    color: var(--accent-color);
  }

  &.active {
    background: var(--accent-color);
    color: white;
  }
}

// 未读闪烁动画
@keyframes navFlashLow {
  0%, 100% { color: var(--text-secondary); }
  50% { color: var(--accent-color); }
}

@keyframes navFlashMedium {
  0%, 68% { color: var(--text-secondary); }
  34% { color: var(--accent-color); }
}

@keyframes navFlashHigh {
  0%, 52% { color: var(--text-secondary); }
  26% { color: var(--accent-color); }
}

.nav-btn.has-unread-flash {
  &.flash-low {
    animation: navFlashLow 3s ease-in-out infinite;
  }

  &.flash-medium {
    animation: navFlashMedium 1.8s ease-in-out infinite;
  }

  &.flash-high {
    animation: navFlashHigh 1s ease-in-out infinite;
  }
}

.user-avatar {
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
}

.nav-badge {
  :deep(.el-badge__content) {
    font-size: 10px;
    height: 16px;
    line-height: 16px;
    padding: 0 5px;
    top: -8px;
    right: -8px;
    z-index: 10;
    border: 2px solid var(--bg-secondary);
  }
}

.nav-btn .nav-badge {
  position: relative;
  display: inline-flex;
}
</style>

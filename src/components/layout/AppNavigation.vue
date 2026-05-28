<template>
  <nav class="app-navigation">
    <!-- 左侧导航按钮 -->
    <div class="nav-left">
      <template v-for="item in navItems" :key="item.key">
        <el-badge
          v-if="item.key === 'chat'"
          :value="totalUnread"
          :hidden="totalUnread === 0 || currentView === 'chat'"
          :max="99"
        >
          <el-button
            :class="['nav-btn', { active: currentView === item.key }]"
            @click="handleNavigate(item.key)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-button>
        </el-badge>
        <el-button
          v-else
          :class="['nav-btn', { active: currentView === item.key }]"
          @click="handleNavigate(item.key)"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-button>
      </template>
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
import { computed, ref, onMounted, watch } from 'vue'
import { ChatDotRound, Files, Setting, MagicStick, User } from '@element-plus/icons-vue'
import { useI18n } from '../../composables/useI18n'
import { getUserAvatar, getAvatarUrl } from '../../composables/useAvatar'
import { chatTotalUnread, refreshTotalUnread } from '../../composables/useChatRoom'

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

const totalUnread = ref(0)

const navItems = computed(() => [
  { key: 'ai', icon: 'MagicStick', label: t('navigation.ai') },
  { key: 'chat', icon: 'ChatDotRound', label: t('navigation.chat') },
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

onMounted(() => {
  refreshTotalUnread()
  // 同步共享的响应式 ref，零延迟
  watch(chatTotalUnread, (val) => {
    totalUnread.value = val
  }, { immediate: true })
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
</style>

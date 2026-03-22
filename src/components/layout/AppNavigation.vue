<template>
  <nav class="app-navigation">
    <!-- 左侧导航按钮 -->
    <div class="nav-left">
      <el-button 
        v-for="item in navItems" 
        :key="item.key"
        :class="['nav-btn', { active: currentView === item.key }]"
        @click="handleNavigate(item.key)"
      >
        <el-icon><component :is="item.icon" /></el-icon>
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
import { computed } from 'vue'
import { ChatDotRound, Files, Setting, MagicStick, User } from '@element-plus/icons-vue'

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

const navItems = [
  { key: 'ai', icon: 'MagicStick', label: 'AI' },
  { key: 'chat', icon: 'ChatDotRound', label: '聊天' },
  { key: 'files', icon: 'Files', label: '文件' },
  { key: 'settings', icon: 'Setting', label: '设置' }
]

const handleNavigate = (view) => {
  emit('navigate', view)
}

const toggleSidebar = () => {
  emit('toggle-sidebar')
}

// 用户头像相关计算属性
const userAvatar = computed(() => {
  return props.userInfo?.avatar || ''
})

const userInitial = computed(() => {
  return props.userInfo?.username?.charAt(0)?.toUpperCase() || 'U'
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

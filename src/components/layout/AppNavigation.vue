<template>
  <nav class="app-navigation">
    <el-button 
      v-for="item in navItems" 
      :key="item.key"
      :class="['nav-btn', { active: currentView === item.key }]"
      @click="handleNavigate(item.key)"
    >
      <el-icon><component :is="item.icon" /></el-icon>
      <span>{{ item.label }}</span>
    </el-button>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { ChatDotRound, Files, Setting, MagicStick } from '@element-plus/icons-vue'

const props = defineProps({
  currentView: {
    type: String,
    default: 'ai'
  }
})

const emit = defineEmits(['navigate'])

const navItems = [
  { key: 'ai', icon: 'MagicStick', label: 'AI' },
  { key: 'chat', icon: 'ChatDotRound', label: '聊天' },
  { key: 'files', icon: 'Files', label: '文件' },
  { key: 'settings', icon: 'Setting', label: '设置' }
]

const handleNavigate = (view) => {
  emit('navigate', view)
}
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
  justify-content: center;
  gap: 20px;
  z-index: 100;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
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
</style>

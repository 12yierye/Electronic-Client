<template>
  <div :class="['app-container', theme]">
    <!-- 未登录显示登录页面 -->
    <Login
      v-if="!isLoggedIn"
      ref="loginRef"
      @login-success="handleLoginSuccess"
      @auto-login-success="handleLoginSuccess"
    />

    <!-- 已登录显示主应用 -->
    <template v-else>
      <!-- 顶部导航 -->
      <AppNavigation
        :current-view="currentView"
        :user-info="userInfo"
        @navigate="handleNavigate"
        @toggle-sidebar="sidebarVisible = true"
      />

      <!-- 主内容区 -->
      <div class="main-content">
        <transition name="fade" mode="out-in">
          <component
            :is="currentComponent"
            :key="currentView"
            @logout="handleLogout"
            @exit="handleExit"
          />
        </transition>
      </div>

      <!-- AI 聊天输入框 -->
      <AIInputFooter v-if="currentView === 'ai'" />

      <!-- 侧边栏 -->
      <AppSidebar
        :visible="sidebarVisible"
        :user-info="userInfo"
        @close="sidebarVisible = false"
        @logout="handleLogout"
        @exit="handleExit"
      />
      <div
        v-if="sidebarVisible"
        class="sidebar-mask"
        @click="sidebarVisible = false"
      ></div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue'
import { useSettingsStore } from './stores/settings'
import AppNavigation from './components/layout/AppNavigation.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import AIInputFooter from './components/common/AIInputFooter.vue'
import Login from './components/views/Login.vue'
import AIChat from './components/views/AIChat.vue'
import ChatRoom from './components/views/ChatRoom.vue'
import FileManager from './components/views/FileManager.vue'
import Settings from './components/views/Settings.vue'

const settingsStore = useSettingsStore()

const currentView = ref('ai')
const sidebarVisible = ref(false)
const userInfo = ref(null)
const isLoggedIn = ref(false)
const loginRef = ref(null)

// 登录成功处理
const handleLoginSuccess = (user) => {
  userInfo.value = user
  isLoggedIn.value = true
}

// 主题
const theme = computed(() => settingsStore.theme)
provide('theme', theme)

// 组件映射
const componentMap = {
  ai: AIChat,
  chat: ChatRoom,
  files: FileManager,
  settings: Settings
}

const currentComponent = computed(() => componentMap[currentView.value])

// 处理导航
const handleNavigate = (view) => {
  currentView.value = view
}

// 处理退出登录
const handleLogout = () => {
  if (window.electronAPI) {
    window.electronAPI.logout()
  }
  userInfo.value = null
  isLoggedIn.value = false
  localStorage.removeItem('userInfo')
  // 退出登录时保留自动登录凭证，下次可以直接登录
}

// 处理退出应用
const handleExit = () => {
  if (window.electronAPI) {
    window.electronAPI.exitApp()
  }
}

// 初始化
onMounted(() => {
  // 加载设置
  settingsStore.loadSettings()
})
</script>

<style lang="scss" scoped>
.app-container {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all 0.3s ease;
  
  &.light {
    --bg-primary: #ecf0f1;
    --bg-secondary: #ffffff;
    --text-primary: #2c3e50;
    --text-secondary: #7f8c8d;
    --accent-color: #3498db;
  }
  
  &.dark {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --text-primary: #ecf0f1;
    --text-secondary: #95a5a6;
    --accent-color: #3498db;
  }
}

.main-content {
  padding-top: 60px;
  min-height: calc(100vh - 60px);
}

.sidebar-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1999; /* Element Plus drawer 的 z-index 通常是 2000 */
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

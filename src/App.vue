<template>
  <el-config-provider :locale="elementLocale">
    <div :class="['app-container', theme]">
      <transition name="view-switch" mode="out-in">
        <!-- 未登录显示登录页面 -->
        <Login
          v-if="!isLoggedIn"
          key="login"
          ref="loginRef"
          @login-success="handleLoginSuccess"
          @auto-login-success="handleLoginSuccess"
        />

        <!-- 已登录显示主应用 -->
        <div v-else key="main" class="main-wrapper">
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
        </div>
      </transition>
    </div>
  </el-config-provider>
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue'
import { useSettingsStore } from './stores/settings'
import { useI18n } from './composables/useI18n'
import AppNavigation from './components/layout/AppNavigation.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import AIInputFooter from './components/common/AIInputFooter.vue'
import Login from './components/views/Login.vue'
import AIChat from './components/views/AIChat.vue'
import ChatRoom from './components/views/ChatRoom.vue'
import FileManager from './components/views/FileManager.vue'
import Settings from './components/views/Settings.vue'

const settingsStore = useSettingsStore()
const { elementLocale } = useI18n()

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

// 主题（解析后的实际主题，支持 auto/跟随系统）
const theme = computed(() => settingsStore.effectiveTheme)
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
  // 退出登录时清除自动登录凭证，避免退出后又自动登录
  localStorage.removeItem('autoLoginCredential')
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

  // 淡出启动加载动画
  const loader = document.getElementById('app-loader')
  if (loader) {
    loader.classList.add('hidden')
    setTimeout(() => {
      if (loader.parentNode) {
        loader.parentNode.removeChild(loader)
      }
    }, 600)
  }
})
</script>

<style lang="scss" scoped>
.app-container {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: background 0.3s ease, color 0.3s ease;
  overflow: hidden;
}

.main-wrapper {
  min-height: 100vh;
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
  z-index: 1999;
}

.view-switch-enter-active,
.view-switch-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.view-switch-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.view-switch-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>



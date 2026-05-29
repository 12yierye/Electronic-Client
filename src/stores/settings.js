import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref('dark')   // 用户偏好: 'dark' | 'light' | 'auto'
  const language = ref('zh-CN')
  const useSystemBrowser = ref(false)  // 是否使用系统默认浏览器打开链接
  const sendKey = ref('Enter')        // 发送消息快捷键: 'Enter' | 'Ctrl+Enter'
  const friendListDensity = ref('compact')  // 好友列表密度: 'compact' | 'relaxed'

  // 系统主题监听
  let systemThemeMedia = null
  const _systemBump = ref(0)  // 系统主题变化时自增，驱动 computed 重算

  const getSystemTheme = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  // 解析后的实际主题（响应式）
  const effectiveTheme = computed(() => {
    void _systemBump.value   // 追踪系统主题变化
    return theme.value === 'auto' ? getSystemTheme() : theme.value
  })

  // 加载设置
  const loadSettings = () => {
    const stored = localStorage.getItem('appSettings')
    if (stored) {
      const settings = JSON.parse(stored)
      theme.value = settings.theme || 'dark'
      language.value = settings.language || 'zh-CN'
      useSystemBrowser.value = settings.useSystemBrowser || false
      sendKey.value = settings.sendKey || 'Enter'
      friendListDensity.value = settings.friendListDensity || 'compact'
    }
    applyTheme()
  }

  // 保存设置
  const saveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify({
      theme: theme.value,
      language: language.value,
      useSystemBrowser: useSystemBrowser.value,
      sendKey: sendKey.value,
      friendListDensity: friendListDensity.value
    }))
  }

  // 应用主题到 DOM
  const applyTheme = () => {
    const isLight = effectiveTheme.value === 'light'
    document.documentElement.classList.toggle('light', isLight)

    // 监听系统主题变化（仅 auto 模式）
    if (systemThemeMedia) {
      systemThemeMedia.removeEventListener('change', onSystemThemeChange)
      systemThemeMedia = null
    }
    if (theme.value === 'auto') {
      systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
      systemThemeMedia.addEventListener('change', onSystemThemeChange)
    }
  }

  const onSystemThemeChange = () => {
    if (theme.value === 'auto') {
      _systemBump.value++
      applyTheme()
    }
  }

  // 切换主题
  const toggleTheme = (newTheme) => {
    theme.value = newTheme
    applyTheme()
    saveSettings()
  }

  // 切换语言
  const toggleLanguage = (newLanguage) => {
    language.value = newLanguage
    saveSettings()
  }

  const toggleUseSystemBrowser = (value) => {
    useSystemBrowser.value = value
    saveSettings()
  }

  const setSendKey = (value) => {
    sendKey.value = value
    saveSettings()
  }

  const setFriendListDensity = (value) => {
    friendListDensity.value = value
    saveSettings()
  }

  return {
    theme,
    language,
    useSystemBrowser,
    sendKey,
    friendListDensity,
    effectiveTheme,
    loadSettings,
    saveSettings,
    applyTheme,
    toggleTheme,
    toggleLanguage,
    toggleUseSystemBrowser,
    setSendKey,
    setFriendListDensity
  }
})

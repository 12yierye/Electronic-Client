import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref('dark')   // 用户偏好: 'dark' | 'light' | 'auto'
  const language = ref('zh-CN')
  const useSystemBrowser = ref(false)  // 是否使用系统默认浏览器打开链接
  const sendKey = ref('Enter')        // 发送消息快捷键: 'Enter' | 'Ctrl+Enter'
  const friendListDensity = ref('compact')  // 好友列表密度: 'compact' | 'relaxed'
  const navFlashIntensity = ref('medium')   // 导航栏未读闪烁程度: 'off' | 'low' | 'medium' | 'high'
  const cacheRetentionDays = ref(30)        // 缓存消息保留天数
  const showModeUnreadBadge = ref(true)     // 模式切换按钮（公网/内网）角标红点
  const showTabUnreadBadge = ref(true)      // 标签页（好友/群聊）角标红点

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
      navFlashIntensity.value = settings.navFlashIntensity || 'medium'
      cacheRetentionDays.value = settings.cacheRetentionDays || 30
      showModeUnreadBadge.value = settings.showModeUnreadBadge !== undefined ? settings.showModeUnreadBadge : true
      showTabUnreadBadge.value = settings.showTabUnreadBadge !== undefined ? settings.showTabUnreadBadge : true
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
      friendListDensity: friendListDensity.value,
      navFlashIntensity: navFlashIntensity.value,
      cacheRetentionDays: cacheRetentionDays.value,
      showModeUnreadBadge: showModeUnreadBadge.value,
      showTabUnreadBadge: showTabUnreadBadge.value
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

  const setNavFlashIntensity = (value) => {
    navFlashIntensity.value = value
    saveSettings()
  }

  const setCacheRetentionDays = (value) => {
    cacheRetentionDays.value = value
    saveSettings()
  }

  const setShowModeUnreadBadge = (value) => {
    showModeUnreadBadge.value = value
    saveSettings()
  }

  const setShowTabUnreadBadge = (value) => {
    showTabUnreadBadge.value = value
    saveSettings()
  }

  return {
    theme,
    language,
    useSystemBrowser,
    sendKey,
    friendListDensity,
    navFlashIntensity,
    cacheRetentionDays,
    showModeUnreadBadge,
    showTabUnreadBadge,
    effectiveTheme,
    loadSettings,
    saveSettings,
    applyTheme,
    toggleTheme,
    toggleLanguage,
    toggleUseSystemBrowser,
    setSendKey,
    setFriendListDensity,
    setNavFlashIntensity,
    setCacheRetentionDays,
    setShowModeUnreadBadge,
    setShowTabUnreadBadge
  }
})

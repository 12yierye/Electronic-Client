<<<<<<< HEAD
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref('dark')
  const language = ref('en')
  
  // 加载设置
  const loadSettings = () => {
    const stored = localStorage.getItem('appSettings')
    if (stored) {
      const settings = JSON.parse(stored)
      theme.value = settings.theme || 'dark'
      language.value = settings.language || 'en'
    }
    applyTheme()
  }
  
  // 保存设置
  const saveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify({
      theme: theme.value,
      language: language.value
    }))
  }
  
  // 应用主题
  const applyTheme = () => {
    if (theme.value === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
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
  
  return {
    theme,
    language,
    loadSettings,
    saveSettings,
    applyTheme,
    toggleTheme,
    toggleLanguage
  }
})
=======
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref('dark')
  const language = ref('en')
  
  // 加载设置
  const loadSettings = () => {
    const stored = localStorage.getItem('appSettings')
    if (stored) {
      const settings = JSON.parse(stored)
      theme.value = settings.theme || 'dark'
      language.value = settings.language || 'en'
    }
    applyTheme()
  }
  
  // 保存设置
  const saveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify({
      theme: theme.value,
      language: language.value
    }))
  }
  
  // 应用主题
  const applyTheme = () => {
    if (theme.value === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
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
  
  return {
    theme,
    language,
    loadSettings,
    saveSettings,
    applyTheme,
    toggleTheme,
    toggleLanguage
  }
})
>>>>>>> f3dad1cfcc8f087826bc135228a1a3df7c24437e

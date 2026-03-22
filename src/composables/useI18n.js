<<<<<<< HEAD
import { ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import messages, { languages, defaultLang } from '../utils/i18n'

// 当前语言
const currentLang = ref(defaultLang)

// 翻译函数
export function useI18n() {
  const settingsStore = useSettingsStore()

  // 初始化语言
  const initLanguage = () => {
    const stored = localStorage.getItem('appSettings')
    if (stored) {
      const settings = JSON.parse(stored)
      if (settings.language) {
        currentLang.value = settings.language
      }
    }
  }

  // 翻译
  const t = (key) => {
    const keys = key.split('.')
    let value = messages[currentLang.value]

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        return key
      }
    }

    return value || key
  }

  // 获取当前语言
  const locale = computed(() => currentLang.value)

  // 设置语言
  const setLocale = (lang) => {
    if (messages[lang]) {
      currentLang.value = lang
      settingsStore.toggleLanguage(lang)
    }
  }

  // 获取语言列表
  const getLanguages = () => languages

  return {
    t,
    locale,
    setLocale,
    getLanguages,
    initLanguage
  }
}
=======
import { ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import messages, { languages, defaultLang } from '../utils/i18n'

// 当前语言
const currentLang = ref(defaultLang)

// 翻译函数
export function useI18n() {
  const settingsStore = useSettingsStore()

  // 初始化语言
  const initLanguage = () => {
    const stored = localStorage.getItem('appSettings')
    if (stored) {
      const settings = JSON.parse(stored)
      if (settings.language) {
        currentLang.value = settings.language
      }
    }
  }

  // 翻译
  const t = (key) => {
    const keys = key.split('.')
    let value = messages[currentLang.value]

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        return key
      }
    }

    return value || key
  }

  // 获取当前语言
  const locale = computed(() => currentLang.value)

  // 设置语言
  const setLocale = (lang) => {
    if (messages[lang]) {
      currentLang.value = lang
      settingsStore.toggleLanguage(lang)
    }
  }

  // 获取语言列表
  const getLanguages = () => languages

  return {
    t,
    locale,
    setLocale,
    getLanguages,
    initLanguage
  }
}
>>>>>>> f3dad1cfcc8f087826bc135228a1a3df7c24437e

import { ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import messages, { languages, defaultLang } from '../utils/i18n'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import en from 'element-plus/dist/locale/en.mjs'
import ja from 'element-plus/dist/locale/ja.mjs'

// Element Plus 语言包映射
const elementLocales = { 'zh-CN': zhCn, 'en': en, 'ja': ja }

// 当前语言（模块级单例，所有 useI18n() 调用共享）
const currentLang = ref(defaultLang)

// 翻译函数
export function useI18n() {
  const settingsStore = useSettingsStore()

  // 初始化语言：从 localStorage 恢复，默认中文
  const initLanguage = () => {
    const stored = localStorage.getItem('appSettings')
    if (stored) {
      try {
        const settings = JSON.parse(stored)
        if (settings.language && messages[settings.language]) {
          currentLang.value = settings.language
        }
      } catch {}
    }
    // 确保 store 也同步
    settingsStore.language = currentLang.value
  }

  // Element Plus 语言包
  const elementLocale = computed(() => elementLocales[currentLang.value] || zhCn)

  // 翻译
  const t = (key, params = {}) => {
    const keys = key.split('.')
    let value = messages[currentLang.value]

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        return key
      }
    }

    let result = value || key

    // 替换参数
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(paramKey => {
        const placeholder = `{${paramKey}}`
        result = result.replace(placeholder, params[paramKey])
      })
    }

    return result
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
    elementLocale,
    setLocale,
    getLanguages,
    initLanguage
  }
}

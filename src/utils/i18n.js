// 国际化语言配置
export const languages = [
  { code: 'zh-CN', name: '简体中文', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' }
]

// 默认语言
export const defaultLang = 'zh-CN'

// 翻译数据
const messages = {
  'zh-CN': {
    app: {
      title: 'AI 助手',
      version: '版本'
    },
    settings: {
      title: '外观设置',
      theme: '主题',
      language: '语言',
      dark: '暗色',
      light: '亮色',
      about: '关于',
      description: '您的个人AI助手',
      selectLanguage: '选择语言',
      languageTip: '界面语言将立即切换'
    },
    theme: {
      dark: '暗色',
      light: '亮色'
    },
    common: {
      confirm: '确认',
      cancel: '取消',
      save: '保存',
      close: '关闭'
    }
  },
  'en': {
    app: {
      title: 'AI Assistant',
      version: 'Version'
    },
    settings: {
      title: 'Appearance Settings',
      theme: 'Theme',
      language: 'Language',
      dark: 'Dark',
      light: 'Light',
      about: 'About',
      description: 'Your personal AI assistant',
      selectLanguage: 'Select Language',
      languageTip: 'Interface language will change immediately'
    },
    theme: {
      dark: 'Dark',
      light: 'Light'
    },
    common: {
      confirm: 'Confirm',
      cancel: 'Cancel',
      save: 'Save',
      close: 'Close'
    }
  },
  'ja': {
    app: {
      title: 'AIアシスタント',
      version: 'バージョン'
    },
    settings: {
      title: '外観設定',
      theme: 'テーマ',
      language: '言語',
      dark: 'ダーク',
      light: 'ライト',
      about: 'について',
      description: 'あなたの個人AIアシスタント',
      selectLanguage: '言語を選択',
      languageTip: 'インターフェース言語が直ちに切り替わります'
    },
    theme: {
      dark: 'ダーク',
      light: 'ライト'
    },
    common: {
      confirm: '確認',
      cancel: 'キャンセル',
      save: '保存',
      close: '閉じる'
    }
  }
}

export default messages

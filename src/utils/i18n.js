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
      close: '关闭',
      send: '发送'
    },
    navigation: {
      ai: 'AI',
      chat: '聊天',
      files: '文件',
      settings: '设置'
    },
    sidebar: {
      title: '用户信息',
      connectionStatus: '连接状态',
      heartbeat: '心跳包 {interval}秒',
      latency: '延迟:',
      packetLoss: '丢包率:',
      logout: '退出登录',
      notLoggedIn: '未登录',
      unknownUser: '用户@example.com'
    },
    login: {
      title: '登录 Electronic',
      username: '用户名',
      password: '密码',
      autoLogin: '自动登录',
      autoLoginEnabled: '自动登录已开启',
      loggingIn: '自动登录中...',
      login: '登录',
      defaultServer: '默认服务器:',
      usernameRequired: '请输入用户名',
      passwordRequired: '请输入密码'
    },
    aiChat: {
      personalAssistant: '您的个人AI助手',
      enterToSend: '按 Enter 发送消息...',
      aiResponse: '这是AI的回复内容，可能与真实答案有所偏差，请谅解。',
      inputRequired: '请输入内容'
    },
    chatRoom: {
      friends: '好友',
      addFriend: '添加好友',
      requests: '申请',
      searchUser: '搜索用户...',
      noFriends: '暂无好友',
      noUsersFound: '未找到用户',
      noRequests: '暂无好友申请',
      selectUser: '选择一个用户开始聊天',
      noChatHistory: '暂无聊天记录',
      add: '添加',
      accept: '接受',
      reject: '拒绝',
      enterMessage: '输入消息...'
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
      close: 'Close',
      send: 'Send'
    },
    navigation: {
      ai: 'AI',
      chat: 'Chat',
      files: 'Files',
      settings: 'Settings'
    },
    sidebar: {
      title: 'User Information',
      connectionStatus: 'Connection Status',
      heartbeat: 'Heartbeat {interval}s',
      latency: 'Latency:',
      packetLoss: 'Packet Loss:',
      logout: 'Logout',
      notLoggedIn: 'Not Logged In',
      unknownUser: 'user@example.com'
    },
    login: {
      title: 'Login Electronic',
      username: 'Username',
      password: 'Password',
      autoLogin: 'Auto Login',
      autoLoginEnabled: 'Auto login enabled',
      loggingIn: 'Logging in...',
      login: 'Login',
      defaultServer: 'Default server:',
      usernameRequired: 'Please enter username',
      passwordRequired: 'Please enter password'
    },
    aiChat: {
      personalAssistant: 'Your personal AI assistant',
      enterToSend: 'Press Enter to send message...',
      aiResponse: 'This is AI response content, there may be some deviation from the actual answer, please understand.',
      inputRequired: 'Please enter content'
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
      close: '閉じる',
      send: '送信'
    },
    navigation: {
      ai: 'AI',
      chat: 'チャット',
      files: 'ファイル',
      settings: '設定'
    },
    sidebar: {
      title: 'ユーザー情報',
      connectionStatus: '接続状態',
      heartbeat: 'ハートビート {interval}秒',
      latency: '遅延:',
      packetLoss: 'パケット損失率:',
      logout: 'ログアウト',
      notLoggedIn: '未ログイン',
      unknownUser: 'user@example.com'
    },
    login: {
      title: 'Electronic にログイン',
      username: 'ユーザー名',
      password: 'パスワード',
      autoLogin: '自動ログイン',
      autoLoginEnabled: '自動ログインが有効です',
      loggingIn: '自動ログイン中...',
      login: 'ログイン',
      defaultServer: 'デフォルトサーバー:',
      usernameRequired: 'ユーザー名を入力してください',
      passwordRequired: 'パスワードを入力してください'
    },
    aiChat: {
      personalAssistant: 'あなたの個人AIアシスタント',
      enterToSend: 'Enterを押してメッセージを送信...',
      aiResponse: 'これはAIの返信内容です。実際の答えとは若干異なる場合がありますので、ご了承ください。',
      inputRequired: '内容を入力してください'
    }
  }
}

export default messages

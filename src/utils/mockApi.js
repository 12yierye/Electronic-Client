// 浏览器环境下的 Mock API
// login 和 register 调用真实服务端接口
// 其余方法提供安全桩防止崩溃

const SERVER_SETTINGS_KEY = 'lanChatSettings'

function getServerBaseUrl() {
  try {
    const raw = localStorage.getItem(SERVER_SETTINGS_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      const ip = s.serverIP || '127.0.0.1'
      const port = s.serverPort || '3000'
      return `http://${ip}:${port}`
    }
  } catch {}
  return 'http://localhost:3000'
}

async function serverFetch(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return await res.json()
  } catch (e) {
    return { success: false, message: `无法连接到服务器 (${e.message})` }
  }
}

export const mockElectronAPI = {
  // ===== 真实服务端请求 =====

  login: async (username, password) => {
    return serverFetch(`${getServerBaseUrl()}/login`, { username, password })
  },

  register: async (userData) => {
    return serverFetch(`${getServerBaseUrl()}/register`, userData)
  },

  getUserByUsername: async (username) => {
    try {
      const res = await fetch(`${getServerBaseUrl()}/user/${encodeURIComponent(username)}`)
      return await res.json()
    } catch (e) {
      return { success: false, message: `无法连接到服务器 (${e.message})` }
    }
  },

  // ===== 保持原有实现（localStorage / 本地逻辑） =====

  logout: async () => {},

  exitApp: async () => {},

  setUser: async () => {},

  verifyCredential: async (username, token) => {
    await new Promise(resolve => setTimeout(resolve, 200))
    const stored = localStorage.getItem('autoLoginCredential')
    if (stored) {
      try {
        const cred = JSON.parse(stored)
        if (cred.username === username && cred.token === token) {
          return { success: true }
        }
      } catch {}
    }
    return { success: false, message: '凭证无效' }
  },

  createCredential: async (username) => {
    await new Promise(resolve => setTimeout(resolve, 200))
    const token = btoa(`${username}:${Date.now()}:${Math.random().toString(36).substr(2)}`)
    return { success: true, token }
  },

  setAiApiUrl: async (url) => {
    console.log('[Mock] AI API URL set:', url)
    return { success: true }
  },

  setApiBaseUrl: async (url) => {
    console.log('[Mock] API Base URL set:', url)
    return { success: true }
  },

  // ===== 数据查询桩 =====

  getUserList: async () => {
    return []
  },

  getFriendsList: async () => {
    return []
  },

  searchUsers: async () => {
    return []
  },

  getFriendRequests: async () => {
    return []
  },

  getGroups: async () => {
    return []
  },

  getGroupMessages: async () => {
    return []
  },

  getChatMessages: async () => {
    return []
  },

  getAllFiles: async () => {
    return []
  },

  getUserFiles: async () => {
    return []
  },

  getStarredUsers: async () => {
    return []
  },

  getCurrentModel: async () => {
    return null
  },

  // ===== 用户操作桩 =====

  addFriend: async () => {
    return { success: false, message: '浏览器环境不支持此功能' }
  },

  removeFriend: async () => {
    return { success: false, message: '浏览器环境不支持此功能' }
  },

  sendFriendRequest: async () => {
    return { success: false, message: '浏览器环境不支持此功能' }
  },

  handleFriendRequest: async () => {
    return { success: false, message: '浏览器环境不支持此功能' }
  },

  starUser: async () => {
    return { success: false, message: '浏览器环境不支持此功能' }
  },

  createGroup: async () => {
    return { success: false, message: '浏览器环境不支持此功能' }
  },

  disbandGroup: async () => {
    return { success: false, message: '浏览器环境不支持此功能' }
  },

  joinGroup: async () => {
    return { success: false, message: '浏览器环境不支持此功能' }
  },

  // ===== 消息操作桩 =====

  sendChatMessage: async () => {
    return { success: true }
  },

  sendGroupMessage: async () => {
    return { success: true }
  },

  scheduleFileSend: async () => {
    return { success: true }
  },

  scheduleMessageSend: async () => {
    return { success: true }
  },

  sendFileNow: async () => {
    return { success: true }
  },

  sendMessageNow: async () => {
    return { success: true }
  },

  // ===== 文件操作桩 =====

  downloadFile: async () => {
    return { success: false, message: '浏览器环境不支持下载' }
  },

  uploadFile: async () => {
    return { success: false, message: '浏览器环境不支持上传' }
  },

  deleteFile: async () => {
    return { success: false, message: '浏览器环境不支持删除' }
  },

  // ===== Electron 对话框桩 =====

  selectImageFile: async () => {
    return { success: false, message: '浏览器环境不支持文件选择' }
  },

  selectDocumentFile: async () => {
    return { success: false, message: '浏览器环境不支持文件选择' }
  },

  selectDirectory: async () => {
    return { success: false, message: '浏览器环境不支持目录选择' }
  },

  ensureDir: async () => {
    return { success: true }
  },

  // ===== 设置桩 =====

  setDownloadDir: async () => {
    return { success: true }
  },

  getDownloadDir: async () => {
    return { success: true, dir: '' }
  },

  openExternal: async (url) => {
    window.open(url, '_blank')
    return { success: true }
  },

  // ===== AI 流式聊天桩 =====

  aiChatStream: async () => {
    return { success: false, message: '浏览器环境不支持AI聊天' }
  },

  onAIChatStreamChunk: () => {},

  removeAIChatStreamListener: () => {},

  // ===== 下载进度桩 =====

  onDownloadProgress: () => {}
}

// 在浏览器环境中注入 mock API
if (typeof window !== 'undefined' && !window.electronAPI) {
  window.electronAPI = mockElectronAPI
}

// 浏览器环境下的 Mock API
// 用于开发调试，不需要连接后端服务器

const mockUsers = [
  { username: 'test', password: '123456', email: 'test@example.com' },
  { username: 'admin', password: 'admin', email: 'admin@example.com' }
]

const mockFriends = [
  { username: 'alice', email: 'alice@example.com' },
  { username: 'bob', email: 'bob@example.com' }
]

const mockMessages = []

// 凭证存储（模拟服务端验证）
const credentials = {}

export const mockElectronAPI = {
  login: async (username, password) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    const user = mockUsers.find(u => u.username === username && u.password === password)
    if (user) {
      return { success: true, user: { username: user.username, email: user.email } }
    }
    return { success: false, message: '用户名或密码错误 (测试账号: test/123456)' }
  },

  register: async (userData) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    if (mockUsers.find(u => u.username === userData.username)) {
      return { success: false, message: '用户名已存在' }
    }
    mockUsers.push({ ...userData })
    return { success: true }
  },

  logout: async () => {},

  exitApp: async () => {},

  setUser: async () => {},

  getUserList: async () => {
    return mockUsers.filter(u => u.username !== 'test')
  },

  getFriendsList: async () => {
    return mockFriends
  },

  addFriend: async () => {
    return { success: true }
  },

  sendChatMessage: async () => {
    return { success: true }
  },

  getChatMessages: async () => {
    return []
  },

  downloadFile: async () => {
    return { success: true, message: '下载成功（Mock）' }
  },

  uploadFile: async () => {
    return { success: true, message: '上传成功（Mock）' }
  },

  deleteFile: async () => {
    return { success: true }
  },

  // 验证凭证
  verifyCredential: async (username, token) => {
    await new Promise(resolve => setTimeout(resolve, 200))
    // 检查本地存储的凭证
    const stored = localStorage.getItem('autoLoginCredential')
    if (stored) {
      const cred = JSON.parse(stored)
      if (cred.username === username && cred.token === token) {
        return { success: true }
      }
    }
    return { success: false, message: '凭证无效' }
  },

  // 根据用户名获取用户信息
  getUserByUsername: async (username) => {
    await new Promise(resolve => setTimeout(resolve, 200))
    const user = mockUsers.find(u => u.username === username)
    if (user) {
      return { success: true, user: { username: user.username, email: user.email } }
    }
    return { success: false, message: '用户不存在' }
  },

  // 创建凭证
  createCredential: async (username) => {
    await new Promise(resolve => setTimeout(resolve, 200))
    const token = btoa(`${username}:${Date.now()}:${Math.random().toString(36).substr(2)}`)
    return { success: true, token }
  }
}

// 在浏览器环境中注入 mock API
if (typeof window !== 'undefined' && !window.electronAPI) {
  window.electronAPI = mockElectronAPI
}

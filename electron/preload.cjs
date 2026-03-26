const { contextBridge, ipcRenderer } = require('electron')

console.log('[Preload] 开始执行...')

// 下载进度回调
let downloadProgressCallback = null
ipcRenderer.on('download-progress', (event, data) => {
  if (downloadProgressCallback) {
    downloadProgressCallback(data)
  }
})

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 测试方法
  testAI: () => {
    console.log('[Preload] testAI 被调用')
    return 'test OK'
  },
  // 下载进度监听
  onDownloadProgress: (callback) => {
    downloadProgressCallback = callback
  },
  // 登录相关
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  register: (userData) => ipcRenderer.invoke('register', userData),
  createRegisterWindow: () => ipcRenderer.invoke('createRegisterWindow'),
  closeRegisterWindow: () => ipcRenderer.send('close-register-window'),
  logout: () => ipcRenderer.send('logout'),
  exitApp: () => ipcRenderer.send('exit-app'),
  setUser: (userInfo) => ipcRenderer.send('set-user', userInfo),
  
  // 文件操作
  downloadFile: (username, filename) => ipcRenderer.invoke('download-file', username, filename),
  uploadFile: (username, filename, fileData) => ipcRenderer.invoke('upload-file', username, filename, fileData),
  deleteFile: (username, filename) => ipcRenderer.invoke('delete-file', username, filename),
  
  // 用户列表
  getUserList: () => ipcRenderer.invoke('get-user-list'),
  getFriendsList: (username) => ipcRenderer.invoke('get-friends-list', username),
  searchUsers: (query) => ipcRenderer.invoke('search-users', query),
  addFriend: (currentUser, friendUsername) => ipcRenderer.invoke('add-friend', currentUser, friendUsername),
  removeFriend: (currentUser, friendUsername) => ipcRenderer.invoke('remove-friend', currentUser, friendUsername),
  
  // 聊天
  sendChatMessage: (messageData) => ipcRenderer.invoke('send-chat-message', messageData),
  getChatMessages: (sender, receiver) => ipcRenderer.invoke('get-chat-messages', sender, receiver),
  
  // 好友申请
  sendFriendRequest: (sender, receiver) => ipcRenderer.invoke('send-friend-request', sender, receiver),
  getFriendRequests: (username, type) => ipcRenderer.invoke('get-friend-requests', username, type),
  handleFriendRequest: (requestId, action) => ipcRenderer.invoke('handle-friend-request', requestId, action),
  
  // 星标
  starUser: (currentUser, starredUsername) => ipcRenderer.invoke('star-user', currentUser, starredUsername),
  getStarredUsers: (username) => ipcRenderer.invoke('get-starred-users', username),

  // 凭证验证
  verifyCredential: (username, token) => ipcRenderer.invoke('verify-credential', username, token),
  getUserByUsername: (username) => ipcRenderer.invoke('get-user-by-username', username),
  createCredential: (username) => ipcRenderer.invoke('create-credential', username),

  // 本地 AI 聊天
  aiChat: (message) => ipcRenderer.invoke('ai-chat', message),

  // 流式 AI 聊天
  aiChatStream: (message) => ipcRenderer.invoke('ai-chat-stream', message),

  // 流式聊天事件监听
  onAIChatStreamChunk: (callback) => {
    ipcRenderer.on('ai-chat-stream-chunk', (event, data) => callback(data))
  },

  // 移除流式聊天监听
  removeAIChatStreamListener: () => {
    ipcRenderer.removeAllListeners('ai-chat-stream-chunk')
    ipcRenderer.removeAllListeners('ai-chat-stream-error')
  },

  // 本地 AI 函数生成
  generateFunction: (prompt) => ipcRenderer.invoke('generate-function', prompt),

  // 获取当前运行的模型
  getCurrentModel: () => ipcRenderer.invoke('get-current-model'),

  // 定时发送文件
  scheduleFileSend: (scheduleTime, targetUser, filename, currentUser) =>
    ipcRenderer.invoke('schedule-file-send', scheduleTime, targetUser, filename, currentUser),

  // 定时发送文字消息
  scheduleMessageSend: (scheduleTime, targetUser, content, currentUser) =>
    ipcRenderer.invoke('schedule-message-send', scheduleTime, targetUser, content, currentUser),

  // 立即发送文件
  sendFileNow: (targetUser, filename, currentUser) =>
    ipcRenderer.invoke('send-file-now', targetUser, filename, currentUser),

  // 立即发送文字消息
  sendMessageNow: (targetUser, content, currentUser) =>
    ipcRenderer.invoke('send-message-now', targetUser, content, currentUser),

  // 获取用户文件列表
  getUserFiles: (username) => ipcRenderer.invoke('get-user-files', username)
})

console.log('Preload script loaded')

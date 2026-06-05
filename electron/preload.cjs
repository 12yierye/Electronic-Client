const { contextBridge, ipcRenderer } = require('electron')

console.log('[Preload] loading...')

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
    console.log('[Preload] testAI called')
    return 'test OK'
  },
  // 下载进度监听
  onDownloadProgress: (callback) => {
    downloadProgressCallback = callback
  },
  // 上传进度监听
  onFileUploadProgress: (callback) => {
    ipcRenderer.on('file:uploadProgress', (event, data) => callback(data))
  },
  removeFileUploadProgressListener: () => {
    ipcRenderer.removeAllListeners('file:uploadProgress')
  },
  // 下载重试监听
  onFileDownloadRetry: (callback) => {
    ipcRenderer.on('file:downloadRetry', (event, data) => callback(data))
  },
  removeFileDownloadRetryListener: () => {
    ipcRenderer.removeAllListeners('file:downloadRetry')
  },
  // 增强文件操作
  uploadFileChunked: (data) => ipcRenderer.invoke('file:uploadChunked', data),
  downloadFileVerified: (data) => ipcRenderer.invoke('file:downloadVerified', data),
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
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),
  selectDocumentFile: () => ipcRenderer.invoke('select-document-file'),
  
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

  // 测试服务器连接
  testServerConnection: () => ipcRenderer.invoke('test-server-connection'),

  // 公网群聊
  getGroups: (username) => ipcRenderer.invoke('get-groups', username),
  createGroup: (data) => ipcRenderer.invoke('create-group', data),
  disbandGroup: (groupId, username) => ipcRenderer.invoke('disband-group', groupId, username),
  getGroupMessages: (groupId) => ipcRenderer.invoke('get-group-messages', groupId),
  sendGroupMessage: (groupId, from, message, type) => ipcRenderer.invoke('send-group-message', groupId, from, message, type),
  joinGroup: (groupId, username) => ipcRenderer.invoke('join-group', groupId, username),
  leaveGroup: (groupId, username) => ipcRenderer.invoke('leave-group', groupId, username),

  // 未读消息
  getUnreadCounts: (username, readPoints) => ipcRenderer.invoke('get-unread-counts', username, readPoints),
  markChatRead: (username, target, lastReadId) => ipcRenderer.invoke('mark-chat-read', username, target, lastReadId),
  markGroupRead: (username, groupId, lastReadId) => ipcRenderer.invoke('mark-group-read', username, groupId, lastReadId),

  // WebSocket & 通知
  wsConnect: (username) => ipcRenderer.invoke('ws-connect', username),
  wsDisconnect: () => ipcRenderer.invoke('ws-disconnect'),
  setBadgeCount: (count) => ipcRenderer.invoke('set-badge-count', count),
  flashWindow: (shouldFlash) => ipcRenderer.invoke('flash-window', shouldFlash),

  // WebSocket 事件监听（主进程 -> 渲染进程）
  onWsNewMessage: (callback) => {
    ipcRenderer.on('ws:new_message', (event, data) => callback(data))
  },
  onWsNewGroupMessage: (callback) => {
    ipcRenderer.on('ws:new_group_message', (event, data) => callback(data))
  },
  onWsOnlineStatus: (callback) => {
    ipcRenderer.on('ws:online_status', (event, data) => callback(data))
  },
  setMyStatus: (status) => ipcRenderer.invoke('user:setStatus', status),
  onWsUpdateBadge: (callback) => {
    ipcRenderer.on('ws:update_badge', () => callback())
  },
  onWsNewBroadcast: (callback) => {
    ipcRenderer.on('ws:broadcast_new', (event, data) => callback(data))
  },
  removeWsListeners: () => {
    ipcRenderer.removeAllListeners('ws:new_message')
    ipcRenderer.removeAllListeners('ws:new_group_message')
    ipcRenderer.removeAllListeners('ws:online_status')
    ipcRenderer.removeAllListeners('ws:update_badge')
    ipcRenderer.removeAllListeners('ws:broadcast_new')
  },

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
  getUserFiles: (username) => ipcRenderer.invoke('get-user-files', username),

  // 获取所有用户的文件（聚合）
  getAllFiles: () => ipcRenderer.invoke('get-all-files'),

  // 下载目录管理
  setDownloadDir: (dir) => ipcRenderer.invoke('set-download-dir', dir),
  getDownloadDir: () => ipcRenderer.invoke('get-download-dir'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  ensureDir: (dir) => ipcRenderer.invoke('ensure-dir', dir),
  setPPTDir: (dir) => ipcRenderer.invoke('set-ppt-dir', dir),
  getPPTDir: () => ipcRenderer.invoke('get-ppt-dir'),
  scanDirectory: (dir) => ipcRenderer.invoke('scan-directory', dir),
  scanDebugDirectory: (dir) => ipcRenderer.invoke('scan-debug-directory', dir),
  deletePPTFile: (paths) => ipcRenderer.invoke('delete-ppt-file', paths),

  // 动态设置 AI API 地址
  setAiApiUrl: (url) => ipcRenderer.invoke('set-ai-api-url', url),

  // 动态设置服务端 API 地址
  setApiBaseUrl: (url) => ipcRenderer.invoke('set-api-base', url),

  // 打开外部链接（优先系统默认浏览器，失败则回退到 Electron 窗口）
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openFilePath: (filePath) => ipcRenderer.invoke('open-file-path', filePath),

  // 组织架构
  org: {
    getTree: () => ipcRenderer.invoke('org:getTree'),
    addNode: (data) => ipcRenderer.invoke('org:addNode', data),
    removeNode: (nodeId) => ipcRenderer.invoke('org:removeNode', nodeId),
    manageMembers: (data) => ipcRenderer.invoke('org:manageMembers', data),
    getNodeMembers: (nodeId) => ipcRenderer.invoke('org:getNodeMembers', nodeId),
  },

  // 广播通知
  broadcast: {
    send: (data) => ipcRenderer.invoke('broadcast:send', data),
    list: (username) => ipcRenderer.invoke('broadcast:list', username),
    receipts: (broadcastId) => ipcRenderer.invoke('broadcast:receipts', broadcastId),
    markRead: (data) => ipcRenderer.invoke('broadcast:markRead', data),
  },

  // AI Agent
  agentRun: (data) => ipcRenderer.invoke('agent:run', data),
  agentCancel: () => ipcRenderer.invoke('agent:cancel'),
  agentCancelPlanning: () => ipcRenderer.invoke('agent:cancelPlanning'),
  agentStatus: () => ipcRenderer.invoke('agent:status'),
  agentGenerateTitle: (message) => ipcRenderer.invoke('agent:generateTitle', { message }),
  testImageSearch: (query, provider) => ipcRenderer.invoke('agent:testImageSearch', { query, provider }),
  onAgentProgress: (callback) => {
    ipcRenderer.on('agent:progress', (event, data) => callback(data))
  },
  onAgentChunk: (callback) => {
    ipcRenderer.on('agent:chunk', (event, data) => callback(data))
  },
  removeAgentListeners: () => {
    ipcRenderer.removeAllListeners('agent:progress')
    ipcRenderer.removeAllListeners('agent:chunk')
  },

  // 自动更新
  checkForUpdate: (silent) => ipcRenderer.invoke('update:check', silent),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update:status', (event, data) => callback(data))
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update:progress', (event, data) => callback(data))
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update:status')
    ipcRenderer.removeAllListeners('update:progress')
  },

  // 调试功能
  debugGeneratePPTX: (data) => ipcRenderer.invoke('agent:debugGeneratePPTX', data),
  onDebugProgress: (callback) => {
    ipcRenderer.on('agent:debugProgress', (event, data) => callback(data))
  },
  removeDebugListeners: () => {
    ipcRenderer.removeAllListeners('agent:debugProgress')
  },

  // 图片搜索提供者配置
  setImageProviderConfig: (config) => ipcRenderer.invoke('set-image-provider-config', config),
  getImageProviderConfig: () => ipcRenderer.invoke('get-image-provider-config'),

  // 系统浏览器设置
  setUseSystemBrowser: (val) => ipcRenderer.invoke('set-use-system-browser', val),
  getUseSystemBrowser: () => ipcRenderer.invoke('get-use-system-browser'),

  // 云端 API 配置
  setCloudApiBase: (url) => ipcRenderer.invoke('set-cloud-api-base', url),
  setCloudApiKey: (key) => ipcRenderer.invoke('set-cloud-api-key', key),
  setCloudModel: (model) => ipcRenderer.invoke('set-cloud-model', model),
  setCloudProvider: (provider) => ipcRenderer.invoke('set-cloud-provider', provider),
  getCloudConfig: () => ipcRenderer.invoke('get-cloud-config'),
  testCloudApi: (data) => ipcRenderer.invoke('test-cloud-api', data),

  // AI 图片生成
  setImageGenConfig: (config) => ipcRenderer.invoke('set-image-gen-config', config),
  getImageGenConfig: () => ipcRenderer.invoke('get-image-gen-config'),
  setImageGenPriority: (val) => ipcRenderer.invoke('set-image-gen-priority', val),
  getImageGenPriority: () => ipcRenderer.invoke('get-image-gen-priority'),
  setImageGenSubPriority: (val) => ipcRenderer.invoke('set-image-gen-sub-priority', val),
  getImageGenSubPriority: () => ipcRenderer.invoke('get-image-gen-sub-priority'),
  setImageGenServer: (config) => ipcRenderer.invoke('set-image-gen-server', config),
  getImageGenServer: () => ipcRenderer.invoke('get-image-gen-server'),
  testImageGen: (prompt) => ipcRenderer.invoke('test-image-gen', { prompt }),
})

console.log('[Preload] ready')

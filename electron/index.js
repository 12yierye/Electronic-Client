import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

app.setPath('userData', join(app.getPath('appData'), 'Electronic'))
app.disableHardwareAcceleration()

let mainWindow = null
const API_BASE = 'http://192.168.61.129:3000'
const DOC_SERVER = 'http://120.24.26.164'
const LM_STUDIO_API = 'http://127.0.0.1:1234/v1'  // LM Studio OpenAI-compatible API

console.log('[Main] Electron 主进程启动')
console.log('[Main] LM Studio API 地址:', LM_STUDIO_API)

function createWindow() {
  const preloadPath = join(__dirname, 'preload.js')
  console.log('[Main] preload 路径:', preloadPath)
  
  mainWindow = new BrowserWindow({
    title: 'Electronic',
    width: 1100,
    height: 600,
    minWidth: 850,
    minHeight: 500,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      cache: false,
      devTools: true
    }
  })
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] 页面加载完成')
  })
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    console.log('[Main] 页面加载失败:', errorCode, errorDesc)
  })

  const menu = Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'Quit', role: 'quit', click: () => app.quit() }
    ]},
    { label: 'Help', submenu: [
      { label: 'About Electronic', click: () => createElectronWindow(DOC_SERVER) },
      { label: 'Electron Docs (zh-cn)', click: () => createElectronWindow('https://www.electronjs.org/zh/docs/latest') }
    ]}
  ])
  mainWindow.setMenu(menu)
  
  // 加载 Vue 应用
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (global.userInfo) {
      mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('userInfo', JSON.stringify(${JSON.stringify(global.userInfo)}))
      `)
    }
  })
}

function createElectronWindow(URL) {
  const win = new BrowserWindow({
    title: 'Electron Docs',
    width: 1000,
    height: 750,
    webPreferences: { webSecurity: false, cache: false }
  })
  win.maximize()
  win.loadURL(URL)
}

async function validateLogin(username, password) {
  try {
    if (!username || !password) return { success: false, message: '用户名或密码不能为空' }
    const response = await axios.post(`${API_BASE}/login`, { username, password }, { timeout: 5000 })
    return response.data
  } catch (err) {
    if (err.response) return { success: false, message: err.response.data.message || '登录失败' }
    if (err.request) return { success: false, message: '无法连接到服务器' }
    return { success: false, message: err.message }
  }
}

async function validateRegister(userData) {
  try {
    if (!userData.username || !userData.password || !userData.email) {
      return { success: false, message: '用户名、密码和邮箱不能为空' }
    }
    const response = await axios.post(`${API_BASE}/register`, userData, { timeout: 5000 })
    return response.data
  } catch (err) {
    if (err.response) return { success: false, message: err.response.data.message || '注册失败' }
    if (err.request) return { success: false, message: '无法连接到服务器' }
    return { success: false, message: err.message }
  }
}

// IPC Handlers
ipcMain.handle('login', async (event, username, password) => {
  const result = await validateLogin(username, password)
  if (result.success && result.user) {
    global.userInfo = { username: result.user.username, email: result.user.email || '', role: result.user.role || '' }
  }
  return result
})

ipcMain.handle('register', async (event, userData) => {
  return await validateRegister(userData)
})

ipcMain.on('logout', () => { mainWindow?.close(); mainWindow = null; global.userInfo = null })
ipcMain.on('exit-app', () => app.quit())
ipcMain.on('set-user', (event, userInfo) => { global.userInfo = userInfo })

ipcMain.handle('download-file', async (event, username, filename) => {
  try {
    const response = await axios({ method: 'GET', url: `${API_BASE}/user/download/${encodeURIComponent(filename)}`, responseType: 'arraybuffer' })
    const downloadsDir = join(app.getPath('downloads'), 'Electronic')
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true })
    fs.writeFileSync(join(downloadsDir, filename), response.data)
    return { success: true, message: '文件下载成功' }
  } catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('upload-file', async (event, username, filename, fileData) => {
  try {
    const response = await axios.post(`${API_BASE}/user/upload?username=${username}&filename=${filename}`, fileData, { headers: { 'Content-Type': 'application/octet-stream' } })
    return response.data
  } catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('delete-file', async (event, username, filename) => {
  try {
    const response = await axios.delete(`${API_BASE}/user/file/${username}/${filename}`)
    return response.data
  } catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('get-user-list', async () => {
  try { return (await axios.get(`${API_BASE}/users`)).data } 
  catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('get-friends-list', async (event, username) => {
  try { return (await axios.get(`${API_BASE}/users/friends?username=${username}`)).data }
  catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('search-users', async (event, searchTerm) => {
  try { return (await axios.get(`${API_BASE}/users/search?q=${searchTerm}`)).data }
  catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('add-friend', async (event, currentUser, friendUsername) => {
  try { return (await axios.post(`${API_BASE}/users/friends/add`, { currentUser, friendUsername })).data }
  catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('remove-friend', async (event, currentUser, friendUsername) => {
  try { return (await axios.post(`${API_BASE}/users/friends/remove`, { currentUser, friendUsername })).data }
  catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('send-chat-message', async (event, messageData) => {
  try { return (await axios.post(`${API_BASE}/chat/send`, messageData)).data }
  catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('get-chat-messages', async (event, sender, receiver) => {
  try { return (await axios.get(`${API_BASE}/chat/messages?sender=${sender}&receiver=${receiver}`)).data }
  catch (error) { return { success: false, message: error.message } }
})

// 验证凭证
ipcMain.handle('verify-credential', async (event, username, token) => {
  try {
    const response = await axios.post(`${API_BASE}/credential/verify`, { username, token })
    return response.data
  } catch (error) { return { success: false, message: error.message } }
})

// 根据用户名获取用户信息
ipcMain.handle('get-user-by-username', async (event, username) => {
  try {
    const response = await axios.get(`${API_BASE}/user/${username}`)
    return response.data
  } catch (error) { return { success: false, message: error.message } }
})

// 创建凭证
ipcMain.handle('create-credential', async (event, username) => {
  try {
    const response = await axios.post(`${API_BASE}/credential/create`, { username })
    return response.data
  } catch (error) { return { success: false, message: error.message } }
})

// 本地 AI 聊天 (LM Studio)
console.log('[Main] 注册 ai-chat IPC 处理程序')
ipcMain.handle('ai-chat', async (event, userMessage) => {
  console.log('[AI Chat] 收到调用，消息:', userMessage)
  try {
    console.log('[AI Chat] 发送消息:', userMessage)
    const requestBody = {
      model: 'gguf',
      messages: [
        { role: 'system', content: '你是一个友好的AI助手，请用中文回答用户的问题。' },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7
    }
    console.log('[AI Chat] 请求体:', JSON.stringify(requestBody, null, 2))
    const response = await axios.post(`${LM_STUDIO_API}/chat/completions`, requestBody, { timeout: 120000 })
    console.log('[AI Chat] LM Studio 响应状态:', response.status)
    console.log('[AI Chat] LM Studio 响应数据:', JSON.stringify(response.data, null, 2))
    const reply = response.data.choices[0].message.content.trim()
    console.log('[AI Chat] 提取的回复:', reply)
    return { success: true, reply }
  } catch (error) {
    console.error('[AI Chat] 错误:', error.message)
    console.error('[AI Chat] 错误详情:', error.response?.data || error.request || error)
    return { success: false, message: error.message }
  }
})

// 本地 AI 函数生成 (LM Studio)
ipcMain.handle('generate-function', async (event, prompt) => {
  try {
    console.log('[Generate Function] 发送提示词:', prompt)
    const requestBody = {
      model: 'gguf',
      messages: [
        { role: 'system', content: '你是一个代码生成助手。根据用户需求，生成一个 JavaScript 函数。只返回函数代码，不要其他解释，不要任何markdown代码块标记。函数要可以直接用 new Function() 执行。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    }
    console.log('[Generate Function] 请求体:', JSON.stringify(requestBody, null, 2))
    const response = await axios.post(`${LM_STUDIO_API}/chat/completions`, requestBody, { timeout: 120000 })
    console.log('[Generate Function] LM Studio 响应状态:', response.status)
    console.log('[Generate Function] LM Studio 响应数据:', JSON.stringify(response.data, null, 2))
    const code = response.data.choices[0].message.content.trim()
    console.log('[Generate Function] 提取的代码:', code)
    return { success: true, code }
  } catch (error) {
    console.error('[Generate Function] 错误:', error.message)
    console.error('[Generate Function] 错误详情:', error.response?.data || error.request || error)
    return { success: false, message: error.message }
  }
})

app.setUserTasks([
  { program: process.execPath, arguments: '--relaunch', iconPath: process.execPath, iconIndex: 0, title: 'Relaunch', description: 'Relaunch Electronic' }
])

console.log('[Main] 准备启动应用...')
app.whenReady().then(() => {
  console.log('[Main] App ready，创建窗口...')
  createWindow()
}).catch(err => {
  console.error('[Main] App ready 错误:', err)
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

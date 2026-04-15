import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

app.setPath('userData', join(app.getPath('appData'), 'Electronic'))
app.disableHardwareAcceleration()

// 清理旧的缓存目录
const cleanOldCache = () => {
  try {
    const userDataPath = app.getPath('userData')
    const cachePath = join(userDataPath, 'Cache')
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true })
      console.log('[Main] 旧缓存已清理')
    }
  } catch (error) {
    console.log('[Main] 清理缓存失败（忽略）:', error.message)
  }
}

cleanOldCache()

let mainWindow = null
const API_BASE = process.env.API_URL || 'http://192.168.61.129:3000'
const DOC_SERVER = 'http://120.24.26.164'
const LM_STUDIO_API = 'http://127.0.0.1:1234/v1'

console.log('[Main] Electron 主进程启动')
console.log('[Main] API 服务器地址:', API_BASE)
console.log('[Main] LM Studio API 地址:', LM_STUDIO_API)

// 检查是否需要禁用 GPU
if (process.argv.includes('--disable-gpu') || process.argv.includes('--disable-gpu-renderer')) {
  console.log('[Main] GPU 加速已通过命令行禁用')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-software-rasterizer')
} else {
  // 默认禁用 GPU 以避免缓存错误
  console.log('[Main] 默认禁用 GPU 以避免缓存权限错误')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-software-rasterizer')
}

process.on('uncaughtException', (error) => {
  if (error.code === 'EPERM' && (error.message.includes('kill') || error.message.includes('not found'))) {
    return
  }
  console.error('[Main] 未捕获的异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] 未处理的 Promise 拒绝:', reason)
})

function createWindow() {
  const isDev = process.env.VITE_DEV_SERVER_URL
  const preloadPath = join(__dirname, isDev ? 'preload.cjs' : 'preload.js')
  console.log('[Main] __dirname:', __dirname)
  console.log('[Main] preload 路径:', preloadPath)
  console.log('[Main] preload 文件存在:', fs.existsSync(preloadPath))
  
  mainWindow = new BrowserWindow({
    title: 'Electronic',
    width: 1100,
    height: 600,
    minWidth: 850,
    minHeight: 500,
    icon: join(__dirname, '../res/index/Electronic Client.ico'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      cache: false,
      devTools: false,
      // 禁用各种缓存以避免权限问题
      partition: 'persist:electronic-main'
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

  mainWindow.webContents.openDevTools()
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (global.userInfo) {
      mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('userInfo', JSON.stringify(${JSON.stringify(global.userInfo)}))
      `)
    }
  })
  
  // 延迟检查 preload 是否执行
  setTimeout(() => {
    mainWindow.webContents.executeJavaScript(`
      console.log('[Renderer] electronAPI 存在:', typeof window.electronAPI)
      console.log('[Renderer] electronAPI.aiChat:', typeof window.electronAPI?.aiChat)
      if (window.electronAPI) {
        console.log('[Renderer] 可用方法:', Object.keys(window.electronAPI).join(', '))
      }
      window.electronAPI && window.electronAPI.testAI ? 'PRELOAD_OK' : 'PRELOAD_MISSING'
    `).then(result => {
      console.log('[Main] Preload 状态:', result)
    }).catch(e => console.log('[Main] 检查失败:', e.message))
  }, 2000)
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
    console.log('[Login] 尝试连接服务器:', API_BASE)
    const response = await axios.post(`${API_BASE}/login`, { username, password }, { timeout: 5000 })
    console.log('[Login] 登录成功')
    return response.data
  } catch (err) {
    console.error('[Login] 错误:', err.message)
    console.error('[Login] 错误详情:', {
      code: err.code,
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      baseURL: API_BASE
    })
    if (err.response) return { success: false, message: err.response.data.message || '登录失败' }
    if (err.request) {
      if (err.code === 'ECONNREFUSED') {
        return { success: false, message: '无法连接到服务器：请确保服务端正在运行在 ' + API_BASE }
      } else if (err.code === 'ETIMEDOUT') {
        return { success: false, message: '连接超时：服务器响应过慢' }
      } else {
        return { success: false, message: `无法连接到服务器 (${err.code})` }
      }
    }
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

ipcMain.on('logout', () => {
  if (mainWindow) {
    mainWindow.close()
    mainWindow = null
  }
  global.userInfo = null
  // 退出登录时清除自动登录凭证，避免退出后又自动登录
  // 渲染进程会自动清除 localStorage
  // 退出登录不是结束进程，而是重新打开登录窗口
  createWindow()
})
ipcMain.on('exit-app', () => app.quit())
ipcMain.on('set-user', (event, userInfo) => { global.userInfo = userInfo })

ipcMain.handle('download-file', async (event, username, filename) => {
  const downloadsDir = join(app.getPath('downloads'), 'Electronic')
  const tempFilename = filename + '.part'
  const finalPath = join(downloadsDir, filename)
  const tempPath = join(downloadsDir, tempFilename)
  
  try {
    // 确保下载目录存在
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true })
    }
    
    // 使用流进行下载，支持中断处理
    const response = await axios({
      method: 'GET',
      url: `${API_BASE}/user/download/${encodeURIComponent(filename)}`,
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        // 可以通过 webContents 发送进度到渲染进程
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        event.sender.send('download-progress', { filename, percentCompleted })
      }
    })
    
    // 使用流写入文件
    const writer = fs.createWriteStream(tempPath)
    
    return new Promise((resolve, reject) => {
      response.data.pipe(writer)
      writer.on('finish', () => {
        // 下载完成，重命名为正式文件名
        fs.renameSync(tempPath, finalPath)
        resolve({ success: true, message: '文件下载成功' })
      })
      writer.on('error', (err) => {
        // 写入失败，删除临时文件
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath)
        }
        reject(err)
      })
    })
  } catch (error) {
    // 下载出错，删除临时文件
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath)
    }
    return { success: false, message: error.message }
  }
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
  catch (error) {
    console.error('[Get User List] 错误:', error.message)
    console.error('[Get User List] 详细信息:', {
      baseURL: API_BASE,
      status: error.response?.status,
      statusText: error.response?.statusText,
      code: error.code
    })
    return { success: false, message: error.message }
  }
})

ipcMain.handle('get-friends-list', async (event, username) => {
  try { return (await axios.get(`${API_BASE}/users/friends?username=${username}`)).data }
  catch (error) { return { success: false, message: error.message } }
})

// 测试服务器连接
ipcMain.handle('test-server-connection', async () => {
  try {
    console.log('[Test Connection] 尝试连接到:', API_BASE)
    const response = await axios.get(`${API_BASE}/health`, { timeout: 3000 })
    console.log('[Test Connection] 成功:', response.data)
    return { success: true, message: '连接成功', data: response.data }
  } catch (error) {
    console.error('[Test Connection] 失败:', error.message)
    console.error('[Test Connection] 错误详情:', {
      code: error.code,
      message: error.message,
      status: error.response?.status,
      baseURL: API_BASE
    })
    return {
      success: false,
      message: `连接失败 (${error.code})`,
      details: {
        code: error.code,
        baseURL: API_BASE,
        hint: getErrorHint(error.code)
      }
    }
  }
})

// 获取错误提示
function getErrorHint(errorCode) {
  const hints = {
    'ECONNREFUSED': '服务器未启动或端口未监听，请检查服务端是否运行',
    'ETIMEDOUT': '连接超时，请检查网络或防火墙设置',
    'ENOTFOUND': '无法解析服务器地址，请检查 API_BASE 配置',
    'ECONNRESET': '连接被重置，可能是服务端主动断开',
    'EHOSTUNREACH': '无法访问服务器地址',
    'ENETUNREACH': '网络不可达'
  }
  return hints[errorCode] || '未知错误'
}

ipcMain.handle('get-friend-requests', async (event, username, type) => {
  try { return (await axios.get(`${API_BASE}/friends/requests?username=${username}&type=${type || 'received'}`)).data }
  catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('handle-friend-request', async (event, requestId, action) => {
  try { return (await axios.post(`${API_BASE}/friends/requests/handle`, { requestId, action })).data }
  catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('send-friend-request', async (event, sender, receiver) => {
  try { return (await axios.post(`${API_BASE}/friends/requests/send`, { sender, receiver })).data }
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

// 星标用户
ipcMain.handle('star-user', async (event, currentUser, starredUsername) => {
  try { return (await axios.post(`${API_BASE}/users/star`, { currentUser, starredUsername })).data }
  catch (error) { return { success: false, message: error.message } }
})

ipcMain.handle('get-starred-users', async (event, username) => {
  try { return (await axios.get(`${API_BASE}/users/starred?username=${username}`)).data }
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

// 非流式响应（保留兼容）
ipcMain.handle('ai-chat', async (event, userMessage) => {
  console.log('[AI Chat] 收到调用，消息:', userMessage)

  // 自动获取当前运行的模型
  let currentModel = null
  try {
    console.log('[AI Chat] 正在获取 LM Studio 模型...')
    // 尝试 /v1/models 端点
    const modelResponse = await axios.get(`${LM_STUDIO_API}/models`, { timeout: 5000 })
    console.log('[AI Chat] LM Studio 响应状态:', modelResponse.status)
    console.log('[AI Chat] LM Studio 响应数据:', JSON.stringify(modelResponse.data))
    
    if (modelResponse.data && modelResponse.data.data && modelResponse.data.data.length > 0) {
      // 取第一个模型
      currentModel = modelResponse.data.data[0].id
      console.log('[AI Chat] 使用当前模型:', currentModel)
    } else {
      console.log('[AI Chat] 未检测到运行中的模型')
      return { success: false, message: '请先在 LM Studio 中加载模型' }
    }
  } catch (error) {
    console.log('[AI Chat] 获取模型失败:', error.message)
    console.log('[AI Chat] 错误详情:', error.response?.data)
    return { success: false, message: '无法连接到 LM Studio，请确保 LM Studio 正在运行' }
  }

  try {
    console.log('[AI Chat] 发送消息:', userMessage)
    // 基础请求参数
    const requestBody = {
      model: currentModel,
      messages: [
        { role: 'system', content: '你是一个友好的AI助手，请用中文回答用户的问题。' },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 16384
    }

    // Qwen3 系列模型可能不支持 temperature 参数
    if (!currentModel.toLowerCase().includes('qwen3') && !currentModel.toLowerCase().includes('qwen')) {
      requestBody.temperature = 0.7
    }

    // Qwen3 模型添加额外参数
    if (currentModel.toLowerCase().includes('qwen3') || currentModel.toLowerCase().includes('qwen')) {
      requestBody.extra_body = {
        enable_thinking: true,
        thinking_budget: 4096
      }
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

// 获取当前运行的模型
ipcMain.handle('get-current-model', async () => {
  try {
    // 使用 /v1/models 端点
    const response = await axios.get(`${LM_STUDIO_API}/models`, { timeout: 5000 })
    console.log('[Get Current Model] LM Studio 响应:', JSON.stringify(response.data))
    if (response.data && response.data.data && response.data.data.length > 0) {
      const model = response.data.data[0].id
      console.log('[Get Current Model] 当前模型:', model)
      return { success: true, model }
    }
    return { success: false, message: '未加载模型' }
  } catch (error) {
    console.error('[Get Current Model] 错误:', error.message)
    return { success: false, message: error.message }
  }
})

// 流式响应 AI 聊天
ipcMain.handle('ai-chat-stream', async (event, userMessage) => {
  console.log('[AI Chat Stream] 收到调用，消息:', userMessage)

  // 自动获取当前运行的模型
  let currentModel = null
  try {
    console.log('[AI Chat Stream] 正在获取 LM Studio 模型...')
    // 尝试 /v1/models 端点
    const modelResponse = await axios.get(`${LM_STUDIO_API}/models`, { timeout: 5000 })
    console.log('[AI Chat Stream] LM Studio 响应状态:', modelResponse.status)
    console.log('[AI Chat Stream] LM Studio 响应数据:', JSON.stringify(modelResponse.data))
    
    if (modelResponse.data && modelResponse.data.data && modelResponse.data.data.length > 0) {
      currentModel = modelResponse.data.data[0].id
      console.log('[AI Chat Stream] 使用当前模型:', currentModel)
    } else {
      console.log('[AI Chat Stream] 未检测到运行中的模型')
      return { success: false, message: '请先在 LM Studio 中加载模型' }
    }
  } catch (error) {
    console.log('[AI Chat Stream] 获取模型失败:', error.message)
    console.log('[AI Chat Stream] 错误详情:', error.response?.data)
    return { success: false, message: '无法连接到 LM Studio，请确保 LM Studio 正在运行' }
  }

  // 检查用户消息是否可能包含定时发送意图
  const hasTimePattern = /(\d{1,2}:\d{2})/.test(userMessage.replace(/：/g, ':'))
  const hasSendPattern = /发送|发给|发送给|定时|说/.test(userMessage)
  const hasUserPattern = /向\s*\S+|发给\s*\S+|发送给\s*\S+/.test(userMessage)
  const likelyScheduledIntent = hasTimePattern && hasSendPattern && hasUserPattern

  // 检查是否是立即发送（没有时间关键词）
  const hasImmediateSendPattern = /^(?!.*\d{1,2}:\d{2}).*(?:发送|发给|发送给)\s+\S+/i.test(userMessage)
  const likelyImmediateIntent = hasImmediateSendPattern && hasUserPattern

  // 构造 system prompt，根据意图类型选择
  let systemPrompt = '你是一个友好的AI助手，请用中文回答用户的问题。'

  if (likelyScheduledIntent || likelyImmediateIntent) {
    // 如果检测到可能是发送意图，添加function calling指导
    systemPrompt = `你是一个友好的AI助手。
当用户表达以下意图时，请按指定格式返回函数名，不要返回其他内容：

1. 定时发送文件意图：用户想在某个具体时间（如"15:30"、"1分钟后"）向某人发送文件
   - 关键词：时间（如"15:30"、"1分钟后"）、发送文件、文件名、接收人
   - 返回格式：FUNCTION:schedule_file_send

2. 立即发送文件意图：用户想现在立即向某人发送文件（没有指定具体时间）
   - 关键词：发送文件、文件名、接收人（无时间或"现在"、"立即"）
   - 返回格式：FUNCTION:send_file_now

3. 定时发送文字消息意图：用户想在某个时间向某人发送文字消息
   - 关键词：时间、发送消息/文字、接收人
   - 返回格式：FUNCTION:schedule_message_send

4. 立即发送文字消息意图：用户想现在立即向某人发送文字消息
   - 关键词：发送消息/文字、接收人（无时间或"现在"、"立即"）
   - 返回格式：FUNCTION:send_message_now

5. 普通聊天：上述情况之外
   - 正常回复用户问题，不要返回任何 FUNCTION: 开头的标记

请根据用户消息判断意图并返回相应格式。如果用户只是询问如何操作，请正常回答。`

    // 发送意图识别结果给前端
    event.sender.send('ai-chat-stream-chunk', { 
      intentDetected: true,
      likelyIntent: likelyScheduledIntent ? 'scheduled' : 'normal'
    })
  }

  // 基础请求参数
  const requestBody = {
    model: currentModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    stream: true,
    // 设置较高的 max_tokens 防止输出被截断
    max_tokens: 16384
  }

  // Qwen3 系列模型可能不支持 temperature 参数，使用 min_p 或其他参数
  // 只有非 Qwen3 模型才添加 temperature
  if (!currentModel.toLowerCase().includes('qwen3') && !currentModel.toLowerCase().includes('qwen')) {
    requestBody.temperature = 0.7
  }

  // Qwen3 模型添加额外参数
  if (currentModel.toLowerCase().includes('qwen3') || currentModel.toLowerCase().includes('qwen')) {
    requestBody.extra_body = {
      enable_thinking: true,
      thinking_budget: 4096
    }
  }

  try {
    const response = await axios.post(
      `${LM_STUDIO_API}/chat/completions`,
      requestBody,
      {
        responseType: 'stream',
        timeout: 120000
      }
    )

    return new Promise((resolve) => {
      let fullReply = ''
      let fullReasoning = ''

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              // 流结束
              event.sender.send('ai-chat-stream-chunk', { done: true, content: fullReply, reasoning: fullReasoning })
              resolve({ success: true, reply: fullReply, reasoning: fullReasoning })
              return
            }

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || ''

              if (reasoning) {
                fullReasoning += reasoning
                // 发送思考内容给前端
                event.sender.send('ai-chat-stream-chunk', { reasoning })
              }
              if (content) {
                fullReply += content
                // 发送增量内容给前端
                event.sender.send('ai-chat-stream-chunk', { content })
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      })

      response.data.on('end', () => {
        if (fullReply || fullReasoning) {
          // 检测模型返回的函数名
          const functionMatch = fullReply.match(/FUNCTION:\s*(schedule_file_send|schedule_message_send|send_file_now|send_message_now)/)
          if (functionMatch) {
            const functionName = functionMatch[1]
            console.log('[AI Chat Stream] 检测到函数调用:', functionName)
            // 通知前端执行函数
            event.sender.send('ai-chat-stream-chunk', { 
              done: true, 
              content: fullReply,
              reasoning: fullReasoning,
              functionCall: functionName
            })
          } else {
            event.sender.send('ai-chat-stream-chunk', { done: true, content: fullReply, reasoning: fullReasoning })
          }
        }
        resolve({ success: true, reply: fullReply, reasoning: fullReasoning })
      })

      response.data.on('error', (err) => {
        console.error('[AI Chat Stream] 流错误:', err.message)
        event.sender.send('ai-chat-stream-error', { message: err.message })
        resolve({ success: false, message: err.message })
      })
    })
  } catch (error) {
    console.error('[AI Chat Stream] 错误:', error.message)
    event.sender.send('ai-chat-stream-error', { message: error.message })
    return { success: false, message: error.message }
  }
})

// 本地 AI 函数生成 (LM Studio)
ipcMain.handle('generate-function', async (event, prompt) => {
  try {
    // 先获取当前运行的模型
    let currentModel = null
    try {
      const modelResponse = await axios.get(`${LM_STUDIO_API}/models`, { timeout: 5000 })
      if (modelResponse.data && modelResponse.data.data && modelResponse.data.data.length > 0) {
        currentModel = modelResponse.data.data[0].id
      } else {
        return { success: false, message: '请先在 LM Studio 中加载模型' }
      }
    } catch (e) {
      return { success: false, message: '无法连接到 LM Studio' }
    }

    console.log('[Generate Function] 使用模型:', currentModel)
    console.log('[Generate Function] 发送提示词:', prompt)
    const requestBody = {
      model: currentModel,
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

// 定时任务存储
const scheduledTasks = new Map()

// 获取用户文件列表
ipcMain.handle('get-user-files', async (event, username) => {
  try {
    const response = await axios.get(`${API_BASE}/user/files/${username}`)
    return response.data
  } catch (error) {
    console.error('[Get User Files] 错误:', error.message)
    return { success: false, message: error.message }
  }
})

// 定时发送文件
ipcMain.handle('schedule-file-send', async (event, scheduleTime, targetUser, filename, currentUser) => {
  try {
    console.log('[Schedule File Send] 定时发送文件:', { scheduleTime, targetUser, filename, currentUser })

    // 获取发送者的文件
    const filesResponse = await axios.get(`${API_BASE}/user/files/${currentUser}`)
    if (!filesResponse.data.success || !filesResponse.data.files) {
      return { success: false, message: '无法获取文件列表' }
    }

    const fileInfo = filesResponse.data.files.find(f => f.filename === filename)
    if (!fileInfo) {
      return { success: false, message: `文件 "${filename}" 不存在` }
    }

    // 计算延迟时间
    const delay = new Date(scheduleTime).getTime() - Date.now()
    if (delay <= 0) {
      return { success: false, message: '定时时间必须是未来时间' }
    }

    // 创建定时任务
    const taskId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const task = setTimeout(async () => {
      try {
        // 1. 下载文件然后发送给目标用户
        const downloadResponse = await axios.get(
          `${API_BASE}/user/download?username=${currentUser}&filename=${filename}`,
          { responseType: 'arraybuffer' }
        )

        // 2. 上传到目标用户
        await axios.post(
          `${API_BASE}/user/upload?username=${targetUser}&filename=${filename}`,
          downloadResponse.data,
          { headers: { 'Content-Type': 'application/octet-stream' } }
        )

        console.log('[Schedule File Send] 文件发送成功:', filename, '->', targetUser)

        // 3. 发送聊天消息记录（双方都能看到）
        const chatMessageData = {
          sender: currentUser,
          receiver: targetUser,
          content: `[定时发送文件] ${filename}`,
          type: 'file',
          fileInfo: {
            filename: filename,
            isScheduled: true
          }
        }
        await axios.post(`${API_BASE}/chat/send`, chatMessageData)

        console.log('[Schedule File Send] 聊天记录已创建')
        scheduledTasks.delete(taskId)
      } catch (err) {
        console.error('[Schedule File Send] 发送失败:', err.message)
        scheduledTasks.delete(taskId)
      }
    }, delay)

    scheduledTasks.set(taskId, {
      task,
      scheduleTime,
      targetUser,
      filename,
      currentUser
    })

    console.log('[Schedule File Send] 任务已创建:', taskId, '将在', scheduleTime, '执行')
    return { success: true, taskId, scheduleTime }
  } catch (error) {
    console.error('[Schedule File Send] 错误:', error.message)
    return { success: false, message: error.message }
  }
})

// 定时发送文字消息
ipcMain.handle('schedule-message-send', async (event, scheduleTime, targetUser, content, currentUser) => {
  try {
    console.log('[Schedule Message Send] 定时发送消息:', { scheduleTime, targetUser, content, currentUser })

    // 计算延迟时间
    const delay = new Date(scheduleTime).getTime() - Date.now()
    if (delay <= 0) {
      return { success: false, message: '定时时间必须是未来时间' }
    }

    // 创建定时任务
    const taskId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const task = setTimeout(async () => {
      try {
        // 发送聊天消息（双方都能看到）
        const chatMessageData = {
          sender: currentUser,
          receiver: targetUser,
          content: content,
          type: 'text',
          isScheduled: true
        }
        await axios.post(`${API_BASE}/chat/send`, chatMessageData)

        console.log('[Schedule Message Send] 消息发送成功:', content, '->', targetUser)
        scheduledTasks.delete(taskId)
      } catch (err) {
        console.error('[Schedule Message Send] 发送失败:', err.message)
        scheduledTasks.delete(taskId)
      }
    }, delay)

    scheduledTasks.set(taskId, {
      task,
      scheduleTime,
      targetUser,
      content,
      currentUser,
      type: 'message'
    })

    console.log('[Schedule Message Send] 任务已创建:', taskId, '将在', scheduleTime, '执行')
    return { success: true, taskId, scheduleTime }
  } catch (error) {
    console.error('[Schedule Message Send] 错误:', error.message)
    return { success: false, message: error.message }
  }
})

// 立即发送文件（无定时）
ipcMain.handle('send-file-now', async (event, targetUser, filename, currentUser) => {
  try {
    console.log('[Send File Now] 立即发送文件:', { targetUser, filename, currentUser })

    // 获取发送者的文件
    const filesResponse = await axios.get(`${API_BASE}/user/files/${currentUser}`)
    if (!filesResponse.data.success || !filesResponse.data.files) {
      return { success: false, message: '无法获取文件列表' }
    }

    const fileInfo = filesResponse.data.files.find(f => f.filename === filename)
    if (!fileInfo) {
      return { success: false, message: `文件 "${filename}" 不存在` }
    }

    // 1. 下载文件然后发送给目标用户
    const downloadResponse = await axios.get(
      `${API_BASE}/user/download?username=${currentUser}&filename=${filename}`,
      { responseType: 'arraybuffer' }
    )

    // 2. 上传到目标用户
    await axios.post(
      `${API_BASE}/user/upload?username=${targetUser}&filename=${filename}`,
      downloadResponse.data,
      { headers: { 'Content-Type': 'application/octet-stream' } }
    )

    console.log('[Send File Now] 文件发送成功:', filename, '->', targetUser)

    // 3. 发送聊天消息记录（双方都能看到）
    const chatMessageData = {
      sender: currentUser,
      receiver: targetUser,
      content: `[发送文件] ${filename}`,
      type: 'file',
      fileInfo: {
        filename: filename,
        isScheduled: false
      }
    }
    await axios.post(`${API_BASE}/chat/send`, chatMessageData)

    console.log('[Send File Now] 聊天记录已创建')
    return { success: true, message: `文件 "${filename}" 已发送给 "${targetUser}"` }
  } catch (error) {
    console.error('[Send File Now] 错误:', error.message)
    return { success: false, message: error.message }
  }
})

// 立即发送文字消息（无定时）
ipcMain.handle('send-message-now', async (event, targetUser, content, currentUser) => {
  try {
    console.log('[Send Message Now] 立即发送消息:', { targetUser, content, currentUser })

    // 发送聊天消息（双方都能看到）
    const chatMessageData = {
      sender: currentUser,
      receiver: targetUser,
      content: content,
      type: 'text',
      isScheduled: false
    }
    await axios.post(`${API_BASE}/chat/send`, chatMessageData)

    console.log('[Send Message Now] 消息发送成功:', content, '->', targetUser)
    return { success: true, message: `消息已发送给 "${targetUser}"` }
  } catch (error) {
    console.error('[Send Message Now] 错误:', error.message)
    return { success: false, message: error.message }
  }
})

// 解析用户消息中的定时发送文件意图
function parseScheduledFileSendIntent(message) {
  // 正则表达式匹配：
  // - "在 XX:XX" 或 "XX:XX"
  // - "向 XXX 发送" 或 "发给 XXX" 或 "发送给 XXX"
  // - "名为 XXX" 或 "XXX.docx" 等文件名
  
  const timePatterns = [
    /在\s*(\d{1,2}:\d{2})/,
    /(\d{1,2}:\d{2})/
  ]

  const userPatterns = [
    /向\s*(\S+?)(?:发送|发送文件|发文件)/,
    /发给\s*(\S+?)(?:发送|发送文件|发文件)/,
    /发送给\s*(\S+?)(?:\s|$|，|,)/
  ]

  const filePatterns = [
    /名为\s*([^\s,，]+(?:\.docx|\.xlsx|\.pdf|\.txt|\.jpg|\.png|\.zip|\.rar))/,
    /(?:发送|发)\s*([^\s,，]+\.docx)/,
    /(?:发送|发)\s*([^\s,，]+\.xlsx)/,
    /(?:发送|发)\s*([^\s,，]+\.pdf)/,
    /(?:发送|发)\s*([^\s,，]+\.txt)/,
    /(?:发送|发)\s*([^\s,，]+\.(?:jpg|png|gif))/,
    /(?:发送|发)\s*([^\s,，]+\.(?:zip|rar|7z))/
  ]

  let time = null
  let targetUser = null
  let filename = null

  for (const pattern of timePatterns) {
    const match = message.match(pattern)
    if (match) {
      time = match[1]
      break
    }
  }

  for (const pattern of userPatterns) {
    const match = message.match(pattern)
    if (match) {
      targetUser = match[1]
      break
    }
  }

  for (const pattern of filePatterns) {
    const match = message.match(pattern)
    if (match) {
      filename = match[1]
      break
    }
  }

  if (time && targetUser && filename) {
    return { time, targetUser, filename }
  }
  return null
}

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

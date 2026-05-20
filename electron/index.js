import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

app.setPath('userData', join(app.getPath('appData'), 'Electronic'))
app.disableHardwareAcceleration()

// Clean old cache on startup
const cleanOldCache = () => {
  try {
    const userDataPath = app.getPath('userData')
    const cachePath = join(userDataPath, 'Cache')
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true })
      console.log('[Main] old cache cleaned')
    }
  } catch (error) {
    console.log('[Main] cache clean skipped:', error.message)
  }
}

cleanOldCache()

let mainWindow = null
const API_BASE = process.env.API_URL || 'http://127.0.0.1:3000'
const DOC_SERVER = process.env.DOC_SERVER || 'http://127.0.0.1:3000'
const LM_STUDIO_API = process.env.LM_STUDIO_API || 'http://127.0.0.1:1234/v1'

console.log('[Main] starting, API:', API_BASE, 'LM Studio:', LM_STUDIO_API)

// GPU — disabled by default to avoid cache permission errors
if (process.argv.includes('--disable-gpu') || process.argv.includes('--disable-gpu-renderer')) {
  console.log('[Main] GPU disabled via CLI')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-software-rasterizer')
} else {
  console.log('[Main] GPU disabled (default)')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-software-rasterizer')
}

process.on('uncaughtException', (error) => {
  // 忽略进程退出时的 PID/ESRCH/EPERM 错误
  if (
    (error.code === 'EPERM' && (error.message.includes('kill') || error.message.includes('not found'))) ||
    (error.code === 'ESRCH') ||
    (error.message && error.message.includes('process') && error.message.includes('not found'))
  ) {
    return
  }
  console.error('[Main] uncaught exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] unhandled rejection:', reason)
})

function createWindow() {
  const preloadPath = join(__dirname, 'preload.cjs')
  console.log('[Main] preload:', preloadPath, 'exists:', fs.existsSync(preloadPath))
  
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
    console.log('[Main] page loaded')
  })
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    console.log('[Main] page load failed:', errorCode, errorDesc)
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
  
  // Check preload after a brief delay
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.executeJavaScript(`
      console.log('[Renderer] electronAPI:', typeof window.electronAPI)
      if (window.electronAPI) {
        console.log('[Renderer] methods:', Object.keys(window.electronAPI).join(', '))
      }
      window.electronAPI && window.electronAPI.testAI ? 'PRELOAD_OK' : 'PRELOAD_MISSING'
    `).then(result => {
      console.log('[Main] preload status:', result)
    }).catch(e => console.log('[Main] preload check failed:', e.message))
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
    console.log('[Login]', username)
    const response = await axios.post(`${API_BASE}/login`, { username, password }, { timeout: 5000 })
    console.log('[Login] ok:', username)
    return response.data
  } catch (err) {
    console.error('[Login] failed:', err.code, err.message)
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
    // 等待旧窗口完全关闭后再创建新窗口，避免竞态
    mainWindow.once('closed', () => {
      mainWindow = null
      createWindow()
    })
    mainWindow.close()
  } else {
    createWindow()
  }
  global.userInfo = null
  // 退出登录时清除自动登录凭证，避免退出后又自动登录
  // 渲染进程会自动清除 localStorage
})
ipcMain.on('exit-app', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners()
    mainWindow = null
  }
  app.quit()
})
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
    console.error('[Get User List] failed:', error.message)
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
    console.log('[Test Connection] probing', API_BASE)
    const response = await axios.get(`${API_BASE}/health`, { timeout: 3000 })
    console.log('[Test Connection] ok')
    return { success: true, message: '连接成功', data: response.data }
  } catch (error) {
    console.error('[Test Connection] failed:', error.message)
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

// Local AI chat (LM Studio)
console.log('[Main] IPC handlers registered')

// Non-streaming response (kept for compatibility)
ipcMain.handle('ai-chat', async (event, userMessage) => {
  console.log('[AI Chat] msg:', userMessage.substring(0, 80))

  let currentModel = null
  try {
    const modelResponse = await axios.get(`${LM_STUDIO_API}/models`, { timeout: 5000 })
    if (modelResponse.data?.data?.length > 0) {
      currentModel = modelResponse.data.data[0].id
      console.log('[AI Chat] model:', currentModel)
    } else {
      console.log('[AI Chat] no model loaded')
      return { success: false, message: '请先在 LM Studio 中加载模型' }
    }
  } catch (error) {
    console.log('[AI Chat] model fetch failed:', error.message)
    return { success: false, message: '无法连接到 LM Studio，请确保 LM Studio 正在运行' }
  }

  try {
    const requestBody = {
      model: currentModel,
      messages: [
        { role: 'system', content: '你是一个友好的AI助手，请用中文回答用户的问题。' },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 16384
    }
    if (!currentModel.toLowerCase().includes('qwen3') && !currentModel.toLowerCase().includes('qwen')) {
      requestBody.temperature = 0.7
    }
    if (currentModel.toLowerCase().includes('qwen3') || currentModel.toLowerCase().includes('qwen')) {
      requestBody.extra_body = { enable_thinking: true, thinking_budget: 4096 }
    }

    const response = await axios.post(`${LM_STUDIO_API}/chat/completions`, requestBody, { timeout: 120000 })
    const reply = response.data.choices[0].message.content.trim()
    console.log('[AI Chat] reply length:', reply.length)
    return { success: true, reply }
  } catch (error) {
    console.error('[AI Chat] error:', error.message)
    return { success: false, message: error.message }
  }
})

// Get current running model
ipcMain.handle('get-current-model', async () => {
  try {
    const response = await axios.get(`${LM_STUDIO_API}/models`, { timeout: 5000 })
    if (response.data?.data?.length > 0) {
      const model = response.data.data[0].id
      console.log('[GetModel]', model)
      return { success: true, model }
    }
    return { success: false, message: '未加载模型' }
  } catch (error) {
    console.error('[GetModel] err:', error.message)
    return { success: false, message: error.message }
  }
})

// Streaming AI chat
ipcMain.handle('ai-chat-stream', async (event, userMessage) => {
  console.log('[AI Stream] msg:', userMessage.substring(0, 80))

  let currentModel = null
  try {
    const modelResponse = await axios.get(`${LM_STUDIO_API}/models`, { timeout: 5000 })
    
    if (modelResponse.data && modelResponse.data.data && modelResponse.data.data.length > 0) {
      currentModel = modelResponse.data.data[0].id
      console.log('[AI Stream] model:', currentModel)
    } else {
      console.log('[AI Stream] no model loaded')
      return { success: false, message: '请先在 LM Studio 中加载模型' }
    }
  } catch (error) {
    console.log('[AI Stream] model fetch failed:', error.message)
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
      let streamBuffer = '' // 缓冲区：处理跨 chunk 的 SSE 数据片段

      response.data.on('data', (chunk) => {
        streamBuffer += chunk.toString()
        // 只在遇到完整行时才处理（以 \n\n 或最后一个完整 \n 分割）
        const parts = streamBuffer.split('\n')
        // 最后一个元素可能是不完整的行，保留在缓冲区
        streamBuffer = parts.pop() || ''

        for (const line of parts) {
          const trimmedLine = line.trim()
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

          const data = trimmedLine.slice(6)
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
              event.sender.send('ai-chat-stream-chunk', { reasoning })
            }
            if (content) {
              fullReply += content
              event.sender.send('ai-chat-stream-chunk', { content })
            }
          } catch (e) {
            console.warn('[AI Stream] JSON parse failed:', data.substring(0, 80))
          }
        }
      })

      response.data.on('end', () => {
        if (fullReply || fullReasoning) {
          const functionMatch = fullReply.match(/FUNCTION:\s*(schedule_file_send|schedule_message_send|send_file_now|send_message_now)/)
          if (functionMatch) {
            const functionName = functionMatch[1]
            console.log('[AI Stream] function call:', functionName)
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
        console.error('[AI Stream] stream error:', err.message)
        event.sender.send('ai-chat-stream-error', { message: err.message })
        resolve({ success: false, message: err.message })
      })
    })
  } catch (error) {
    console.error('[AI Stream] error:', error.message)
    event.sender.send('ai-chat-stream-error', { message: error.message })
    return { success: false, message: error.message }
  }
})

// Local AI function generation (LM Studio)
ipcMain.handle('generate-function', async (event, prompt) => {
  try {
    let currentModel = null
    try {
      const modelResponse = await axios.get(`${LM_STUDIO_API}/models`, { timeout: 5000 })
      if (modelResponse.data?.data?.length > 0) {
        currentModel = modelResponse.data.data[0].id
      } else {
        return { success: false, message: '请先在 LM Studio 中加载模型' }
      }
    } catch (e) {
      return { success: false, message: '无法连接到 LM Studio' }
    }

    console.log('[GenFunc] model:', currentModel, 'prompt:', prompt.substring(0, 80))
    const requestBody = {
      model: currentModel,
      messages: [
        { role: 'system', content: '你是一个代码生成助手。根据用户需求，生成一个 JavaScript 函数。只返回函数代码，不要其他解释，不要任何markdown代码块标记。函数要可以直接用 new Function() 执行。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    }
    const response = await axios.post(`${LM_STUDIO_API}/chat/completions`, requestBody, { timeout: 120000 })
    const code = response.data.choices[0].message.content.trim()
    console.log('[GenFunc] code length:', code.length)
    return { success: true, code }
  } catch (error) {
    console.error('[GenFunc] error:', error.message)
    return { success: false, message: error.message }
  }
})

// 定时任务存储
const scheduledTasks = new Map()
const SCHEDULED_TASKS_FILE = join(app.getPath('userData'), 'scheduled-tasks.json')

// 持久化定时任务到文件
const saveScheduledTasks = () => {
  try {
    const tasksData = []
    for (const [taskId, taskInfo] of scheduledTasks) {
      tasksData.push({
        taskId,
        scheduleTime: taskInfo.scheduleTime,
        targetUser: taskInfo.targetUser,
        filename: taskInfo.filename,
        content: taskInfo.content,
        currentUser: taskInfo.currentUser,
        type: taskInfo.type
      })
    }
    fs.writeFileSync(SCHEDULED_TASKS_FILE, JSON.stringify(tasksData, null, 2))
    console.log('[Scheduled] saved', tasksData.length, 'tasks')
  } catch (err) {
    console.error('[Scheduled] save failed:', err.message)
  }
}

// Restore scheduled tasks from file
const restoreScheduledTasks = () => {
  try {
    if (!fs.existsSync(SCHEDULED_TASKS_FILE)) return
    const raw = fs.readFileSync(SCHEDULED_TASKS_FILE, 'utf-8')
    const tasksData = JSON.parse(raw)
    console.log('[Scheduled] restoring', tasksData.length, 'tasks')

    const now = Date.now()
    for (const taskData of tasksData) {
      const scheduledTime = new Date(taskData.scheduleTime).getTime()
      const delay = scheduledTime - now

      if (delay <= 0) {
        console.log('[Scheduled] skip expired:', taskData.taskId)
        continue
      }

      const task = setTimeout(async () => {
        try {
          await executeScheduledTask(taskData)
          scheduledTasks.delete(taskData.taskId)
          saveScheduledTasks()
        } catch (err) {
          console.error('[Scheduled] task failed:', taskData.taskId, err.message)
        }
      }, delay)

      scheduledTasks.set(taskData.taskId, {
        task,
        scheduleTime: taskData.scheduleTime,
        targetUser: taskData.targetUser,
        filename: taskData.filename,
        content: taskData.content,
        currentUser: taskData.currentUser,
        type: taskData.type
      })
      console.log('[Scheduled] restored:', taskData.taskId, '@', taskData.scheduleTime)
    }
  } catch (err) {
    console.error('[Scheduled] restore failed:', err.message)
  }
}

// 执行定时任务的具体逻辑
const executeScheduledTask = async (taskData) => {
  if (taskData.type === 'file') {
    // 下载文件然后发送给目标用户
    const downloadResponse = await axios.get(
      `${API_BASE}/user/download?username=${taskData.currentUser}&filename=${taskData.filename}`,
      { responseType: 'arraybuffer' }
    )
    await axios.post(
      `${API_BASE}/user/upload?username=${taskData.targetUser}&filename=${taskData.filename}`,
      downloadResponse.data,
      { headers: { 'Content-Type': 'application/octet-stream' } }
    )
    const chatMessageData = {
      sender: taskData.currentUser,
      receiver: taskData.targetUser,
      content: `[定时发送文件] ${taskData.filename}`,
      type: 'file',
      fileInfo: { filename: taskData.filename, isScheduled: true }
    }
    await axios.post(`${API_BASE}/chat/send`, chatMessageData)
    console.log('[Scheduled] file sent:', taskData.filename, '->', taskData.targetUser)
  } else if (taskData.type === 'message') {
    const chatMessageData = {
      sender: taskData.currentUser,
      receiver: taskData.targetUser,
      content: taskData.content,
      type: 'text',
      isScheduled: true
    }
    await axios.post(`${API_BASE}/chat/send`, chatMessageData)
    console.log('[Scheduled] msg sent:', taskData.content?.substring(0, 30), '->', taskData.targetUser)
  }
}

// 获取用户文件列表
ipcMain.handle('get-user-files', async (event, username) => {
  try {
    const response = await axios.get(`${API_BASE}/user/files/${username}`)
    return response.data
  } catch (error) {
    console.error('[GetUserFiles] err:', error.message)
    return { success: false, message: error.message }
  }
})

// 定时发送文件
ipcMain.handle('schedule-file-send', async (event, scheduleTime, targetUser, filename, currentUser) => {
  try {
    console.log('[SchedFile]', targetUser, filename, '@', scheduleTime)

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
    const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    const taskData = {
      type: 'file',
      scheduleTime,
      targetUser,
      filename,
      currentUser
    }
    const task = setTimeout(async () => {
      try {
        await executeScheduledTask(taskData)
        console.log('[SchedFile] done:', filename, '->', targetUser)
        scheduledTasks.delete(taskId)
        saveScheduledTasks()
      } catch (err) {
        console.error('[SchedFile] failed:', err.message)
        scheduledTasks.delete(taskId)
        saveScheduledTasks()
      }
    }, delay)

    scheduledTasks.set(taskId, {
      task,
      ...taskData
    })

    console.log('[SchedFile] task created:', taskId, '@', scheduleTime)
    return { success: true, taskId, scheduleTime }
  } catch (error) {
    console.error('[SchedFile] error:', error.message)
    return { success: false, message: error.message }
  }
})

// 定时发送文字消息
ipcMain.handle('schedule-message-send', async (event, scheduleTime, targetUser, content, currentUser) => {
  try {
    console.log('[SchedMsg]', targetUser, '@', scheduleTime)

    // 计算延迟时间
    const delay = new Date(scheduleTime).getTime() - Date.now()
    if (delay <= 0) {
      return { success: false, message: '定时时间必须是未来时间' }
    }

    // 创建定时任务
    const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    const taskData = {
      type: 'message',
      scheduleTime,
      targetUser,
      content,
      currentUser
    }
    const task = setTimeout(async () => {
      try {
        await executeScheduledTask(taskData)
        console.log('[SchedMsg] done:', targetUser)
        scheduledTasks.delete(taskId)
        saveScheduledTasks()
      } catch (err) {
        console.error('[SchedMsg] failed:', err.message)
        scheduledTasks.delete(taskId)
        saveScheduledTasks()
      }
    }, delay)

    scheduledTasks.set(taskId, {
      task,
      ...taskData
    })

    saveScheduledTasks()

    console.log('[SchedMsg] task created:', taskId, '@', scheduleTime)
    return { success: true, taskId, scheduleTime }
  } catch (error) {
    console.error('[SchedMsg] error:', error.message)
    return { success: false, message: error.message }
  }
})

// 立即发送文件（无定时）
ipcMain.handle('send-file-now', async (event, targetUser, filename, currentUser) => {
  try {
    console.log('[SendNow] file:', filename, '->', targetUser)

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

    console.log('[SendNow] file done:', filename, '->', targetUser)
    return { success: true, message: `文件 "${filename}" 已发送给 "${targetUser}"` }
  } catch (error) {
    console.error('[SendNow] file error:', error.message)
    return { success: false, message: error.message }
  }
})

// 立即发送文字消息（无定时）
ipcMain.handle('send-message-now', async (event, targetUser, content, currentUser) => {
  try {
    console.log('[SendNow] msg:', targetUser)

    // 发送聊天消息（双方都能看到）
    const chatMessageData = {
      sender: currentUser,
      receiver: targetUser,
      content: content,
      type: 'text',
      isScheduled: false
    }
    await axios.post(`${API_BASE}/chat/send`, chatMessageData)

    console.log('[SendNow] msg done:', targetUser)
    return { success: true, message: `消息已发送给 "${targetUser}"` }
  } catch (error) {
    console.error('[SendNow] msg error:', error.message)
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

// 退出前清理：清除所有定时器，避免退出时打印 PID 进程丢失警告
app.on('before-quit', () => {
  console.log('[Main] cleaning up before quit...')
  for (const [taskId, taskInfo] of scheduledTasks) {
    clearTimeout(taskInfo.task)
    scheduledTasks.delete(taskId)
  }
  saveScheduledTasks()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners()
    mainWindow = null
  }
})

app.on('will-quit', () => {
  // 确保所有定时器已清除
  for (const [taskId, taskInfo] of scheduledTasks) {
    clearTimeout(taskInfo.task)
  }
  scheduledTasks.clear()

  // 开发模式下结束父进程(Vite)，关闭终端
  if (process.env.VITE_DEV_SERVER_URL) {
    try { process.kill(process.ppid) } catch (_) {}
  }
})

console.log('[Main] starting app...')
app.whenReady().then(() => {
  console.log('[Main] app ready')
  restoreScheduledTasks()
  createWindow()
}).catch(err => {
  console.error('[Main] app ready error:', err)
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

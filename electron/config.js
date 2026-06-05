import { app } from 'electron'

// 服务端 API 地址（运行时可变）
let apiBase = process.env.API_URL || 'http://127.0.0.1:3000'
global.__apiBase = apiBase

export const getAPIBase = () => global.__apiBase || apiBase

export const setAPIBase = (url) => {
    if (url && typeof url === 'string') {
        apiBase = url.replace(/\/+$/, '')
        global.__apiBase = apiBase
        console.log('[Config] API Base updated:', apiBase)
    }
}

// 公网服务器 URL（认证源，与 apiBase 可不同）
let publicServerUrl = ''
export const getPublicServerUrl = () => publicServerUrl || getAPIBase()
export const setPublicServerUrl = (url) => { if (url) publicServerUrl = url }

// LAN 服务器 URL（可选）
let lanServerUrl = ''
export const getLanServerUrl = () => lanServerUrl
export const setLanServerUrl = (url) => { lanServerUrl = url }

// 用户认证信息
let authToken = ''
let userId = ''
export const getAuthToken = () => authToken
export const setAuthToken = (token) => { authToken = token }
export const getUserId = () => userId
export const setUserId = (id) => { userId = id }

export const DOC_SERVER = process.env.DOC_SERVER || 'http://120.24.26.164'
export const SCHEDULED_TASKS_FILE = app.getPath('userData') + '/scheduled-tasks.json'

// LM Studio API 地址（运行时可变）
let lmStudioApi = process.env.LM_STUDIO_API || 'http://127.0.0.1:1234/v1'

export const getLMStudioAPI = () => lmStudioApi

export const setLMStudioAPI = (url) => {
    if (url && typeof url === 'string') {
        lmStudioApi = url.replace(/\/+$/, '')
        console.log('[Config] LM Studio API updated:', lmStudioApi)
    }
}

// 下载目录（运行时可变）
let downloadDir = null

export const getDownloadDir = () => downloadDir || app.getPath('downloads')

export const setDownloadDir = (dir) => {
    downloadDir = dir
    console.log('[Config] Download dir updated:', downloadDir)
}

let pptDir = null
export const getPPTDir = () => pptDir || getDownloadDir()
export const setPPTDir = (dir) => {
    pptDir = dir
    console.log('[Config] PPT dir updated:', pptDir)
}

export let mainWindow = null

export const setMainWindow = (win) => {
  mainWindow = win
}

export const getMainWindow = () => mainWindow

export const getErrorHint = (errorCode) => {
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

let cloudApiBase = 'https://api.openai.com/v1'
let cloudApiKey = ''
let cloudModel = 'gpt-4o'
let cloudProvider = ''

export const getCloudAPIBase = () => cloudApiBase
export const setCloudAPIBase = (url) => {
  if (url && typeof url === 'string') {
    cloudApiBase = url.replace(/\/+$/, '')
    console.log('[Config] Cloud API Base updated:', cloudApiBase)
  }
}
export const getCloudAPIKey = () => cloudApiKey
export const setCloudAPIKey = (key) => {
  if (key && typeof key === 'string') {
    cloudApiKey = key
    console.log('[Config] Cloud API Key updated')
  }
}
export const getCloudModel = () => cloudModel
export const setCloudModel = (model) => {
  if (model && typeof model === 'string') {
    cloudModel = model
    console.log('[Config] Cloud Model updated:', cloudModel)
  }
}
export const getCloudProvider = () => cloudProvider
export const setCloudProvider = (provider) => {
  if (provider && typeof provider === 'string') {
    cloudProvider = provider
    console.log('[Config] Cloud Provider updated:', cloudProvider)
  }
}

let imageProviderConfig = {}
export const getProviderConfig = (providerId) => imageProviderConfig[providerId]
export const setProviderConfig = (config) => { if (config) imageProviderConfig = config }
export const getAllProviderConfigs = () => imageProviderConfig

let useSystemBrowser = false
export const getUseSystemBrowser = () => useSystemBrowser
export const setUseSystemBrowser = (val) => { useSystemBrowser = !!val }

let imageGenConfig = null
let imageGenPriority = 'search'
let imageGenServerIp = '127.0.0.1'
let imageGenServerPort = '7860'
export const getImageGenConfig = () => imageGenConfig
export const setImageGenConfig = (config) => { imageGenConfig = config }
export const getImageGenPriority = () => imageGenPriority
export const setImageGenPriority = (val) => { imageGenPriority = val === 'generate' ? 'generate' : 'search' }
let imageGenSubPriority = 'search'
export const getImageGenSubPriority = () => imageGenSubPriority
export const setImageGenSubPriority = (val) => { imageGenSubPriority = val === 'server' ? 'server' : 'search' }
export const getImageGenServerIP = () => imageGenServerIp
export const setImageGenServerIP = (ip) => { if (ip) imageGenServerIp = ip }
export const getImageGenServerPort = () => imageGenServerPort
export const setImageGenServerPort = (port) => { if (port) imageGenServerPort = port }
export const getImageGenServerURL = () => `http://${imageGenServerIp}:${imageGenServerPort}`

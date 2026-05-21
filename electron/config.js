import { app } from 'electron'

export const API_BASE = process.env.API_URL || 'http://127.0.0.1:3000'
export const DOC_SERVER = process.env.DOC_SERVER || 'http://127.0.0.1:3000'
export const SCHEDULED_TASKS_FILE = app.getPath('userData') + '/scheduled-tasks.json'

// LM Studio API 地址（运行时可变）
let lmStudioApi = process.env.LM_STUDIO_API || 'http://127.0.0.1:1234/v1'

export const getLMStudioAPI = () => lmStudioApi

export const setLMStudioAPI = (url) => {
  if (url && typeof url === 'string') {
    lmStudioApi = url.replace(/\/+$/, '')  // 去掉末尾斜杠
    console.log('[Config] LM Studio API updated:', lmStudioApi)
  }
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

import axios from 'axios'
import { API_BASE } from '../config.js'

export async function validateLogin(username, password) {
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

export async function validateRegister(userData) {
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

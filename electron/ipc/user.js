import { ipcMain } from 'electron'
import axios from 'axios'
import { API_BASE } from '../config.js'
import { getErrorHint } from '../config.js'

export function registerUserIpc() {
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
}

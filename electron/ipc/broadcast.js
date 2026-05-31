import { ipcMain } from 'electron'
import axios from 'axios'
import { getAPIBase } from '../config.js'

export function registerBroadcastIpc() {
  ipcMain.handle('broadcast:send', async (event, { senderId, targetNodeIds, title, content, attachments }) => {
    try {
      return (await axios.post(`${getAPIBase()}/api/broadcast/send`, {
        senderId, targetNodeIds, title, content, attachments
      })).data
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('broadcast:list', async (event, username) => {
    try {
      return (await axios.get(`${getAPIBase()}/api/broadcast/list?username=${encodeURIComponent(username)}`)).data
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('broadcast:receipts', async (event, broadcastId) => {
    try {
      return (await axios.get(`${getAPIBase()}/api/broadcast/receipts/${encodeURIComponent(broadcastId)}`)).data
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('broadcast:markRead', async (event, { broadcastId, username }) => {
    try {
      return (await axios.post(`${getAPIBase()}/api/broadcast/read/${encodeURIComponent(broadcastId)}`, { username })).data
    } catch (error) {
      return { success: false, message: error.message }
    }
  })
}

import { ipcMain } from 'electron'
import axios from 'axios'
import { getAPIBase } from '../config.js'

export function registerOrgIpc() {
  ipcMain.handle('org:getTree', async () => {
    try {
      return (await axios.get(`${getAPIBase()}/api/org/tree`)).data
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('org:addNode', async (event, { parentId, name, type }) => {
    try {
      return (await axios.post(`${getAPIBase()}/api/org/node`, { parentId, name, type })).data
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('org:removeNode', async (event, nodeId) => {
    try {
      return (await axios.delete(`${getAPIBase()}/api/org/node/${encodeURIComponent(nodeId)}`)).data
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('org:manageMembers', async (event, { nodeId, userIds, action }) => {
    try {
      return (await axios.put(`${getAPIBase()}/api/org/node/${encodeURIComponent(nodeId)}/members`, {
        userIds, action
      })).data
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('org:getNodeMembers', async (event, nodeId) => {
    try {
      return (await axios.get(`${getAPIBase()}/api/org/node/${encodeURIComponent(nodeId)}/members`)).data
    } catch (error) {
      return { success: false, message: error.message }
    }
  })
}

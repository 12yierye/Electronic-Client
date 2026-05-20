import { app, ipcMain } from 'electron'
import axios from 'axios'
import { API_BASE, mainWindow, setMainWindow } from '../config.js'
import { validateLogin, validateRegister } from '../services/serverApi.js'
import { createWindow } from '../window.js'

export function registerAuthIpc() {
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
      mainWindow.once('closed', () => {
        setMainWindow(null)
        createWindow()
      })
      mainWindow.close()
    } else {
      createWindow()
    }
    global.userInfo = null
  })

  ipcMain.on('exit-app', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeAllListeners()
      setMainWindow(null)
    }
    app.quit()
  })

  ipcMain.on('set-user', (event, userInfo) => { global.userInfo = userInfo })

  ipcMain.handle('verify-credential', async (event, username, token) => {
    try {
      const response = await axios.post(`${API_BASE}/credential/verify`, { username, token })
      return response.data
    } catch (error) { return { success: false, message: error.message } }
  })

  ipcMain.handle('get-user-by-username', async (event, username) => {
    try {
      const response = await axios.get(`${API_BASE}/user/${username}`)
      return response.data
    } catch (error) { return { success: false, message: error.message } }
  })

  ipcMain.handle('create-credential', async (event, username) => {
    try {
      const response = await axios.post(`${API_BASE}/credential/create`, { username })
      return response.data
    } catch (error) { return { success: false, message: error.message } }
  })
}

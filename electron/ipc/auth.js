import { app, ipcMain } from 'electron'
import axios from 'axios'
import { getAPIBase, setAPIBase, mainWindow, setMainWindow } from '../config.js'
import { validateLogin, validateRegister } from '../services/serverApi.js'
import { createWindow } from '../window.js'
import { disconnectWebSocket } from '../services/websocket.js'

export function registerAuthIpc() {
    ipcMain.handle('set-api-base', (event, url) => {
        setAPIBase(url)
        return { success: true }
    })

    ipcMain.handle('login', async (event, username, password) => {
        const result = await validateLogin(username, password)
        if (result.success && result.user) {
            global.userInfo = { username: result.user.username, email: result.user.email || '', role: result.user.role || '', avatar: result.user.avatar || '' }
        }
        return result
    })

    ipcMain.handle('register', async (event, userData) => {
        return await validateRegister(userData)
    })

    ipcMain.handle('user-logout', async () => {
        disconnectWebSocket()
        global.userInfo = null
        if (mainWindow) {
            mainWindow.once('closed', () => {
                setMainWindow(null)
                createWindow()
            })
            mainWindow.close()
        } else {
            createWindow()
        }
        return { success: true }
    })

    ipcMain.on('logout', () => {
        disconnectWebSocket()
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
        disconnectWebSocket()
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeAllListeners()
            setMainWindow(null)
        }
        app.quit()
    })

    ipcMain.on('set-user', (event, userInfo) => { global.userInfo = userInfo })

    ipcMain.handle('verify-credential', async (event, username, token) => {
        try {
            const response = await axios.post(`${getAPIBase()}/credential/verify`, { username, token })
            return response.data
        } catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('get-user-by-username', async (event, username) => {
        try {
            const response = await axios.get(`${getAPIBase()}/user/${username}`)
            return response.data
        } catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('create-credential', async (event, username) => {
        try {
            const response = await axios.post(`${getAPIBase()}/credential/create`, { username })
            return response.data
        } catch (error) { return { success: false, message: error.message } }
    })
}

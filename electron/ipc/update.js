import { ipcMain } from 'electron'
import { checkForUpdates, downloadUpdate, installUpdate } from '../services/autoUpdater.js'

export function registerUpdateIpc() {
  ipcMain.handle('update:check', async (event, silent = false) => {
    checkForUpdates(silent)
    return { success: true }
  })

  ipcMain.handle('update:download', async () => {
    downloadUpdate()
    return { success: true }
  })

  ipcMain.handle('update:install', async () => {
    installUpdate()
    return { success: true }
  })
}

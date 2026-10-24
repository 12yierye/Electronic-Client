import { ipcMain } from 'electron'
import { checkForUpdates, downloadUpdate, installUpdate, isAutoCheckEnabled, setAutoCheckEnabled } from '../services/autoUpdater.js'

export function registerUpdateIpc() {
    ipcMain.handle('update:check', async (event, silent = false, force = false) => {
        return await checkForUpdates(silent, force)
    })

    ipcMain.handle('update:download', async () => {
        downloadUpdate()
        return { success: true }
    })

    ipcMain.handle('update:install', async () => {
        installUpdate()
        return { success: true }
    })

    ipcMain.handle('update:get-auto-check', async () => {
        return { success: true, value: isAutoCheckEnabled() }
    })

    ipcMain.handle('update:set-auto-check', async (event, enabled) => {
        return { success: true, value: setAutoCheckEnabled(enabled) }
    })
}

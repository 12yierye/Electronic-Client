import { ipcMain, shell } from 'electron'

export function registerExternalIpc() {
    ipcMain.handle('open-external', async (event, url) => {
        try {
            const result = await shell.openExternal(url)
            return { success: !!result }
        } catch (err) {
            console.log('[External] shell.openExternal failed:', err.message)
            return { success: false }
        }
    })
}
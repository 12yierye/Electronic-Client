import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import fs from 'fs'
import { setMainWindow } from './config.js'
import { createWindow } from './window.js'
import { registerAuthIpc } from './ipc/auth.js'
import { registerUserIpc } from './ipc/user.js'
import { registerFileIpc } from './ipc/file.js'
import { registerAiIpc } from './ipc/ai.js'
import { registerTaskIpc } from './ipc/task.js'
import { clearAllScheduledTasks, saveScheduledTasks, restoreScheduledTasks } from './services/scheduledTasks.js'

app.setPath('userData', join(app.getPath('appData'), 'Electronic'))
app.disableHardwareAcceleration()

const cleanOldCache = () => {
  try {
    const cachePath = join(app.getPath('userData'), 'Cache')
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true })
      console.log('[Main] old cache cleaned')
    }
  } catch (error) {
    console.log('[Main] cache clean skipped:', error.message)
  }
}
cleanOldCache()

if (process.argv.includes('--disable-gpu') || process.argv.includes('--disable-gpu-renderer')) {
  console.log('[Main] GPU disabled via CLI')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-software-rasterizer')
} else {
  console.log('[Main] GPU disabled (default)')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-software-rasterizer')
}

process.on('uncaughtException', (error) => {
  if (
    (error.code === 'EPERM' && (error.message.includes('kill') || error.message.includes('not found'))) ||
    (error.code === 'ESRCH') ||
    (error.message && error.message.includes('process') && error.message.includes('not found'))
  ) {
    return
  }
  console.error('[Main] uncaught exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] unhandled rejection:', reason)
})

registerAuthIpc()
registerUserIpc()
registerFileIpc()
registerAiIpc()
registerTaskIpc()
console.log('[Main] IPC handlers registered')

app.setUserTasks([
  { program: process.execPath, arguments: '--relaunch', iconPath: process.execPath, iconIndex: 0, title: 'Relaunch', description: 'Relaunch Electronic' }
])

app.on('before-quit', () => {
  console.log('[Main] cleaning up before quit...')
  clearAllScheduledTasks()
  saveScheduledTasks()
  const mw = BrowserWindow.getAllWindows()[0]
  if (mw && !mw.isDestroyed()) {
    mw.removeAllListeners()
  }
})

app.on('will-quit', () => {
  clearAllScheduledTasks()
  if (process.env.VITE_DEV_SERVER_URL) {
    try { process.kill(process.ppid) } catch (_) {}
  }
})

console.log('[Main] starting app...')
app.whenReady().then(() => {
  console.log('[Main] app ready')
  restoreScheduledTasks()
  createWindow()
}).catch(err => {
  console.error('[Main] app ready error:', err)
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

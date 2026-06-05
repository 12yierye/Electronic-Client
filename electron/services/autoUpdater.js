import pkg from 'electron-updater'; const { autoUpdater } = pkg
import { getMainWindow } from '../config.js'

// 关闭自动下载，让用户点击后再下载
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

// 是否处于静默检查模式（启动时后台检查，不打扰用户）
let isSilentCheck = false

/**
 * 向渲染进程发送更新事件
 */
function sendToRenderer(channel, data) {
  const mw = getMainWindow()
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send(channel, data)
  }
}

// ===== 注册 autoUpdater 事件 =====

autoUpdater.on('checking-for-update', () => {
  console.log('[AutoUpdater] Checking for update...')
  if (!isSilentCheck) {
    sendToRenderer('update:status', { status: 'checking' })
  }
})

autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdater] Update available:', info.version)
  sendToRenderer('update:status', {
    status: 'update-available',
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes,
  })
  isSilentCheck = false
})

autoUpdater.on('update-not-available', (info) => {
  console.log('[AutoUpdater] Update not available, current:', info.version)
  sendToRenderer('update:status', {
    status: 'update-not-available',
    version: info.version,
  })
  isSilentCheck = false
})

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent)
  const speed = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(1)
  const transferred = (progressObj.transferred / 1024 / 1024).toFixed(1)
  const total = (progressObj.total / 1024 / 1024).toFixed(1)
  console.log(`[AutoUpdater] Downloading... ${percent}% (${transferred}MB / ${total}MB @ ${speed}MB/s)`)
  sendToRenderer('update:progress', {
    percent,
    speed: parseFloat(speed),
    transferred: parseFloat(transferred),
    total: parseFloat(total),
    bytesPerSecond: progressObj.bytesPerSecond,
  })
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('[AutoUpdater] Update downloaded:', info.version)
  sendToRenderer('update:status', {
    status: 'update-downloaded',
    version: info.version,
  })
})

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Error:', err.message || err)
  // 静默检查模式下出错不通知用户
  if (!isSilentCheck) {
    sendToRenderer('update:status', {
      status: 'error',
      message: err.message || '未知错误',
    })
  }
  isSilentCheck = false
})

// ===== 导出 API =====

/**
 * 检查更新
 * @param {boolean} silent - 静默模式（启动时后台检查），出错不通知用户
 */
export function checkForUpdates(silent = false) {
  isSilentCheck = silent
  sendToRenderer('update:status', { status: 'checking' })
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[AutoUpdater] checkForUpdates failed:', err.message)
    if (!silent) {
      sendToRenderer('update:status', {
        status: 'error',
        message: err.message || '检查更新失败',
      })
    }
    isSilentCheck = false
  })
}

/**
 * 下载更新
 */
export function downloadUpdate() {
  sendToRenderer('update:status', { status: 'downloading' })
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('[AutoUpdater] downloadUpdate failed:', err.message)
    sendToRenderer('update:status', {
      status: 'error',
      message: err.message || '下载更新失败',
    })
  })
}

/**
 * 安装更新并重启应用
 */
export function installUpdate() {
  autoUpdater.quitAndInstall(false, true)
}

import { Notification } from 'electron'
import { getAPIBase, getMainWindow } from '../config.js'
import WebSocket from 'ws'

let ws = null
let reconnectTimer = null
let currentUsername = null
const RECONNECT_DELAY = 3000

export function connectWebSocket(username) {
  if (!username) return
  currentUsername = username
  disconnectWebSocket()

  const baseUrl = getAPIBase().replace(/^http/, 'ws')
  const wsUrl = `${baseUrl}/ws`
  console.log('[WS] Connecting to:', wsUrl)

  try {
    ws = new WebSocket(wsUrl)

    ws.on('open', () => {
      console.log('[WS] Connected')
      // 认证
      ws.send(JSON.stringify({ type: 'auth', username }))
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        handleWsMessage(msg)
      } catch (e) {
        console.error('[WS] Parse error:', e.message)
      }
    })

    ws.on('close', () => {
      console.log('[WS] Disconnected')
      ws = null
      scheduleReconnect()
    })

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message || err)
    })
  } catch (e) {
    console.error('[WS] Connect error:', e.message)
    scheduleReconnect()
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    try { ws.close() } catch (_) {}
    ws = null
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (!currentUsername) return
  reconnectTimer = setTimeout(() => {
    console.log('[WS] Reconnecting...')
    connectWebSocket(currentUsername)
  }, RECONNECT_DELAY)
}

function handleWsMessage(msg) {
  const mw = getMainWindow()
  if (!mw || mw.isDestroyed()) return

  switch (msg.type) {
    case 'new_message': {
      // 转发给渲染进程
      mw.webContents.send('ws:new_message', msg)
      // 如果窗口未聚焦，发送系统通知
      if (!mw.isFocused()) {
        showNotification(msg.conversation.target, msg.message.message)
      }
      // 更新任务栏角标
      updateBadge()
      break
    }
    case 'new_group_message': {
      mw.webContents.send('ws:new_group_message', msg)
      if (!mw.isFocused()) {
        showNotification(
          `${msg.conversation.groupName || '群聊'} - ${msg.message.from}`,
          msg.message.message
        )
      }
      updateBadge()
      break
    }
    case 'online_status': {
      mw.webContents.send('ws:online_status', msg)
      break
    }
  }
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return
  try {
    const notif = new Notification({
      title: title || '新消息',
      body: (body || '').substring(0, 200),
      silent: false,
      urgency: 'normal'
    })
    notif.on('click', () => {
      const mw = getMainWindow()
      if (mw && !mw.isDestroyed()) {
        if (mw.isMinimized()) mw.restore()
        mw.focus()
      }
    })
  } catch (e) {
    console.error('[Notification] Error:', e.message)
  }
}

function updateBadge() {
  // 通知渲染进程更新角标（渲染进程计算总未读数后回传）
  const mw = getMainWindow()
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send('ws:update_badge')
  }
}

// IPC: 渲染进程通知主进程更新任务栏角标数字
export function setBadgeCount(count) {
  const mw = getMainWindow()
  if (!mw || mw.isDestroyed()) return
  try {
    if (typeof count === 'number' && count > 0) {
      mw.setBadgeCount(count)
    } else {
      mw.setBadgeCount(0)
    }
  } catch (e) {
    // Electron 版本可能不支持 setBadgeCount
  }
}

// IPC: 渲染进程设置窗口标题闪烁
export function flashWindow(shouldFlash) {
  const mw = getMainWindow()
  if (mw && !mw.isDestroyed() && shouldFlash) {
    try { mw.flashFrame(true) } catch (_) {}
  }
}

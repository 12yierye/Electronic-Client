import { Notification, app } from 'electron'
import { getAPIBase, getMainWindow } from '../config.js'
import { join } from 'node:path'
import fs from 'fs'
import WebSocket from 'ws'

let ws = null
let reconnectTimer = null
let currentUsername = null
const RECONNECT_DELAY = 3000

const OFFLINE_QUEUE_FILE = join(app.getPath('userData'), 'offline-queue.json')
let offlineQueue = []
let queueLoaded = false

function loadOfflineQueue() {
  if (queueLoaded) return
  try {
    if (fs.existsSync(OFFLINE_QUEUE_FILE)) {
      const raw = fs.readFileSync(OFFLINE_QUEUE_FILE, 'utf-8')
      offlineQueue = JSON.parse(raw)
    }
  } catch {}
  queueLoaded = true
}

function persistOfflineQueue() {
  try {
    fs.writeFileSync(OFFLINE_QUEUE_FILE, JSON.stringify(offlineQueue), 'utf-8')
  } catch (e) {
    console.error('[WS] Failed to persist offline queue:', e.message)
  }
}

function enqueueOfflineMessage(messageData) {
  offlineQueue.push({ ...messageData, queuedAt: Date.now() })
  persistOfflineQueue()
}

async function flushOfflineQueue() {
  if (offlineQueue.length === 0) return
  const mw = getMainWindow()
  const queue = [...offlineQueue]
  offlineQueue = []
  persistOfflineQueue()

  if (mw && !mw.isDestroyed()) {
    mw.webContents.send('ws:flush_queue', { count: queue.length })
  }
}

export function sendMessageWithQueue(sendFn, messageData) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    enqueueOfflineMessage(messageData)
    const mw = getMainWindow()
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send('ws:message_queued', { target: messageData.receiver, tempId: messageData._tempId })
    }
    return { success: true, queued: true }
  }
  sendFn(messageData)
  return { success: true, queued: false }
}

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
      loadOfflineQueue()
      ws.send(JSON.stringify({ type: 'auth', username }))
      flushOfflineQueue()
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
        showNotification(msg.conversation?.target || '新消息', msg.message?.message || '')
      }
      // 更新任务栏角标
      updateBadge()
      break
    }
    case 'new_group_message': {
      mw.webContents.send('ws:new_group_message', msg)
      if (!mw.isFocused()) {
        const groupName = msg.conversation?.groupName || msg.message?.groupName || '群聊'
        const sender = msg.message?.from || '群成员'
        showNotification(
          `[${groupName}] ${sender}`,
          msg.message?.message || ''
        )
      }
      updateBadge()
      break
    }
    case 'online_status': {
      mw.webContents.send('ws:online_status', msg)
      break
    }
    case 'broadcast:new': {
      mw.webContents.send('ws:broadcast_new', msg.broadcast || msg)
      if (!mw.isFocused()) {
        showNotification('广播通知', msg.broadcast?.title || '')
      }
      updateBadge()
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

// 消息本地缓存模块
// 缓存已读的聊天消息到 localStorage，超过保留期限自动清理

// ====== 消息内容缓存 ======
const CACHE_KEY_PREFIX = 'msgcache_'

export function cacheKey(username, convType, convId) {
  return `${CACHE_KEY_PREFIX}${username}_${convType}_${convId}`
}

/** 存储消息到本地缓存 */
export function saveMessagesToCache(username, convType, convId, messages) {
  if (!username || !convId || !messages?.length) return
  try {
    const key = cacheKey(username, convType, convId)
    localStorage.setItem(key, JSON.stringify(messages))
  } catch (e) {
    cleanExpiredCache(username, 7)
    try {
      localStorage.setItem(cacheKey(username, convType, convId), JSON.stringify(messages))
    } catch (_) {}
  }
}

/** 从本地缓存加载消息 */
export function loadMessagesFromCache(username, convType, convId) {
  if (!username || !convId) return null
  try {
    const key = cacheKey(username, convType, convId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const messages = JSON.parse(raw)
    if (!Array.isArray(messages) || messages.length === 0) return null
    return messages
  } catch {
    return null
  }
}

/** 清理超过保留天数的缓存消息（单条消息级别） */
export function cleanExpiredCache(username, retentionDays) {
  if (!username) return
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const prefix = `${CACHE_KEY_PREFIX}${username}_`

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(prefix)) continue
    try {
      const messages = JSON.parse(localStorage.getItem(key))
      if (!Array.isArray(messages)) {
        localStorage.removeItem(key)
        continue
      }
      const filtered = messages.filter(m => {
        const t = new Date(m.timestamp || 0).getTime()
        return t > cutoff
      })
      if (filtered.length === 0) {
        localStorage.removeItem(key)
      } else if (filtered.length < messages.length) {
        localStorage.setItem(key, JSON.stringify(filtered))
      }
    } catch {
      localStorage.removeItem(key)
    }
  }
}

/** 删除指定会话的缓存 */
export function removeConversationCache(username, convType, convId) {
  if (!username || !convId) return
  const key = cacheKey(username, convType, convId)
  localStorage.removeItem(key)
}

// ====== 已读消息 ID 追踪（基于唯一标识符，绝不依赖消息内容对比） ======
const SEEN_PREFIX = 'seen_ids_'
const SEEN_MAX_SIZE = 10000

function seenKey(username) {
  return SEEN_PREFIX + username
}

function getSeenSet(username) {
  if (!username) return new Set()
  try {
    const raw = localStorage.getItem(seenKey(username))
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveSeenSet(username, set) {
  if (!username) return
  try {
    const arr = [...set]
    // 超过上限时保留最近的一半
    const toSave = arr.length > SEEN_MAX_SIZE ? arr.slice(-Math.floor(SEEN_MAX_SIZE / 2)) : arr
    localStorage.setItem(seenKey(username), JSON.stringify(toSave))
  } catch {
    // 写入失败（localStorage 满），裁剪后重试
    const arr = [...set].slice(-1000)
    try { localStorage.setItem(seenKey(username), JSON.stringify(arr)) } catch (_) {}
  }
}

/**
 * 检查消息 ID 是否已被标记为已读
 * @param {string} username
 * @param {string|number} messageId - 消息唯一标识符
 * @returns {boolean}
 */
export function isMessageSeen(username, messageId) {
  if (!username || messageId == null) return false
  const set = getSeenSet(username)
  return set.has(String(messageId))
}

/**
 * 将单条消息 ID 标记为已读
 * @param {string} username
 * @param {string|number} messageId
 */
export function markMessageSeen(username, messageId) {
  if (!username || messageId == null) return
  const set = getSeenSet(username)
  if (set.has(String(messageId))) return  // 已存在，无需写入
  set.add(String(messageId))
  saveSeenSet(username, set)
}

/**
 * 批量标记消息 ID 为已读（避免频繁写 localStorage）
 * @param {string} username
 * @param {(string|number)[]} messageIds
 */
export function markMessagesSeen(username, messageIds) {
  if (!username || !messageIds?.length) return
  const set = getSeenSet(username)
  let changed = false
  for (const id of messageIds) {
    if (id != null && !set.has(String(id))) {
      set.add(String(id))
      changed = true
    }
  }
  if (changed) saveSeenSet(username, set)
}

/** 清除用户的所有已读 ID 记录 */
export function clearSeenCache(username) {
  if (!username) return
  localStorage.removeItem(seenKey(username))
}

// ====== 消息发送状态追踪 ======
const DELIVERY_KEY_PREFIX = 'msg_delivery_'

function deliveryKey(username) {
  return DELIVERY_KEY_PREFIX + username
}

function getDeliveryMap(username) {
  if (!username) return {}
  try {
    const raw = localStorage.getItem(deliveryKey(username))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveDeliveryMap(username, map) {
  if (!username) return
  try {
    localStorage.setItem(deliveryKey(username), JSON.stringify(map))
  } catch {}
}

/**
 * 设置消息发送状态
 * @param {'sending'|'sent'|'delivered'|'read'|'failed'} status
 */
export function setMessageDeliveryStatus(username, messageId, status) {
  if (!username || !messageId) return
  const map = getDeliveryMap(username)
  map[String(messageId)] = { status, updatedAt: Date.now() }
  if (Object.keys(map).length > 1000) {
    const entries = Object.entries(map).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 500)
    const trimmed = {}
    entries.forEach(([k, v]) => { trimmed[k] = v })
    saveDeliveryMap(username, trimmed)
  } else {
    saveDeliveryMap(username, map)
  }
}

export function getMessageDeliveryStatus(username, messageId) {
  if (!username || !messageId) return 'unknown'
  const map = getDeliveryMap(username)
  return map[String(messageId)]?.status || 'unknown'
}

export function clearDeliveryCache(username) {
  if (!username) return
  localStorage.removeItem(deliveryKey(username))
}

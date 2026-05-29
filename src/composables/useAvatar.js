import { ref } from 'vue'

const cache = ref(new Map())
const pendingFetches = new Set()
const avatarVersion = ref(Date.now())

function getServerBaseUrl() {
  try {
    const raw = localStorage.getItem('lanChatSettings')
    if (raw) {
      const s = JSON.parse(raw)
      const ip = s.serverIP || '127.0.0.1'
      const port = s.serverPort || '3000'
      return `http://${ip}:${port}`
    }
  } catch {}
  return 'http://localhost:3000'
}

export function getAvatarUrl(url) {
  // 读取 avatarVersion 建立 Vue 响应式依赖，版本变化时自动重新计算
  const version = avatarVersion.value
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/')) return `${getServerBaseUrl()}${url}?v=${version}`
  return url
}

export function getUserAvatar(username, serverAvatarUrl) {
  if (!username) return ''
  // 读取版本号建立 Vue 响应式依赖，确保版本变化时模板自动重新求值
  const _version = avatarVersion.value
  const map = cache.value
  if (map.has(username)) return map.get(username)

  if (serverAvatarUrl) {
    const url = getAvatarUrl(serverAvatarUrl)
    if (url) map.set(username, url)
    return url || ''
  }

  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'))
    if (userInfo && userInfo.username === username && userInfo.avatar) {
      const url = getAvatarUrl(userInfo.avatar)
      map.set(username, url)
      return url
    }
  } catch {}

  map.set(username, '')
  return ''
}

export async function loadUserAvatar(username) {
  if (!username) return ''
  const map = cache.value
  if (map.has(username)) return map.get(username)
  if (pendingFetches.has(username)) return

  pendingFetches.add(username)

  try {
    let data
    if (window.electronAPI?.getUserByUsername) {
      data = await window.electronAPI.getUserByUsername(username)
    } else {
      const res = await fetch(`${getServerBaseUrl()}/user/${encodeURIComponent(username)}`)
      data = await res.json()
    }
    if (data.success && data.user?.avatar) {
      const url = getAvatarUrl(data.user.avatar)
      map.set(username, url)
      return url
    }
  } catch {}
  map.set(username, '')
  return ''
}

export function loadUsersAvatars(usernames) {
  const unique = [...new Set(usernames.filter(Boolean))]
  unique.forEach(u => loadUserAvatar(u))
}

export function clearAvatarCache() {
  cache.value = new Map()
  pendingFetches.clear()
  avatarVersion.value = Date.now()
}

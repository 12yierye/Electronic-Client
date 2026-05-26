import { ref } from 'vue'

const cache = ref(new Map())

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
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/')) return `${getServerBaseUrl()}${url}`
  return url
}

export function getUserAvatar(username) {
  if (!username) return ''
  const map = cache.value
  if (map.has(username)) return map.get(username)

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

export function clearAvatarCache() {
  cache.value = new Map()
}

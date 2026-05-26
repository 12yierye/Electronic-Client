import { ref } from 'vue'

const cache = ref(new Map())

function loadAvatar(username) {
  try {
    const saved = localStorage.getItem(`profile_${username}`)
    return saved ? JSON.parse(saved).avatar || '' : ''
  } catch {
    return ''
  }
}

export function getUserAvatar(username) {
  if (!username) return ''
  const map = cache.value
  if (map.has(username)) return map.get(username)
  const avatar = loadAvatar(username)
  map.set(username, avatar)
  return avatar
}

export function clearAvatarCache() {
  cache.value = new Map()
}

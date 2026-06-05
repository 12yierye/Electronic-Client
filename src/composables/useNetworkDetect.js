import { ref, computed } from 'vue'

const PRIMARY_SERVER_KEY = 'primaryServer'

export function useNetworkDetect() {
  const networkMode = ref('public')
  const isChecking = ref(false)

  const isOnCampus = computed(() => networkMode.value === 'campus')

  function getPrimaryServer() {
    try {
      const raw = localStorage.getItem(PRIMARY_SERVER_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return parsed.url || ''
      }
    } catch {}
    return ''
  }

  function savePrimaryServer(url) {
    localStorage.setItem(PRIMARY_SERVER_KEY, JSON.stringify({ url }))
  }

  async function detectNetwork(campusIP, campusPort) {
    isChecking.value = true
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)

      const url = `http://${campusIP}:${campusPort}/health`
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)

      if (res.ok) {
        networkMode.value = 'campus'
        return 'campus'
      }
    } catch {
      // Campus server unreachable
    }
    networkMode.value = 'public'
    return 'public'
  }

  return {
    networkMode,
    isOnCampus,
    isChecking,
    getPrimaryServer,
    savePrimaryServer,
    detectNetwork,
  }
}

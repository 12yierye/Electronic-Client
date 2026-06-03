import axios from 'axios'
import { getProviderConfig } from '../config.js'

const SCRAPER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/json,*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://www.bing.com/'
}

const REFERER_MAP = {
  baidu: 'https://image.baidu.com/',
  bing: 'https://www.bing.com/images/search',
  pixabay: 'https://pixabay.com/',
  pexels: 'https://www.pexels.com/',
  unsplash: 'https://unsplash.com/'
}

const PROVIDERS = {
  baidu: {
    name: '百度图片',
    builtin: true,
    quota: '免 API',
    desc: '内置爬虫，无需配置',
    search: async (query, _key, perPage) => {
      const res = await axios.get('https://image.baidu.com/search/acjson', {
        params: {
          tn: 'resultjson_com', ipn: 'rj', word: query, rn: perPage,
          pn: 0, ie: 'utf-8', oe: 'utf-8', cl: 2, lm: -1, st: -1, z: 0, face: 0, s: 0,
          highlight: 'null', nc: 1
        },
        headers: { ...SCRAPER_HEADERS, Referer: REFERER_MAP.baidu },
        timeout: 12000
      })
      const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      let data
      try { data = JSON.parse(raw) } catch { data = res.data }
      return (data?.data || []).filter(p => p?.thumbURL).map(p => ({
        url: p.thumbURL,
        original: p.objURL || p.middleURL || p.thumbURL,
        photographer: p.fromURL ? new URL(p.fromURL).hostname : '百度图片',
        alt: p.fromPageTitle || query
      }))
    }
  },
  bing: {
    name: '必应图片',
    builtin: true,
    quota: '免 API',
    desc: '内置爬虫，无需配置',
    search: async (query, _key, perPage) => {
      const res = await axios.get('https://www.bing.com/images/search', {
        params: { q: query, count: perPage, FORM: 'HDRSC2' },
        headers: { ...SCRAPER_HEADERS, 'Accept': 'text/html,*/*' },
        timeout: 8000
      })
      const html = res.data
      const results = []
      const imgDataRe = /<a[^>]+class="[^"]*thumb[^"]*"[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>/gi
      let m
      while ((m = imgDataRe.exec(html)) !== null && results.length < perPage) {
        const src = m[2]?.startsWith('http') ? m[2] : null
        const link = m[1]?.startsWith('http') ? m[1] : null
        if (src) results.push({ url: src, original: link || src, photographer: '必应图片', alt: query })
      }
      if (results.length === 0) {
        const fallbackRe = /<img[^>]+class="[^"]*mimg[^"]*"[^>]+src="([^"]+)"[^>]*>/gi
        while ((m = fallbackRe.exec(html)) !== null && results.length < perPage) {
          if (m[1]?.startsWith('http')) results.push({ url: m[1], original: m[1], photographer: '必应图片', alt: query })
        }
      }
      return results
    }
  },
  pixabay: {
    name: 'Pixabay',
    builtin: false,
    quota: '5000次/时',
    desc: '免费 API，需注册 Key',
    search: async (query, key, perPage) => {
      const res = await axios.get('https://pixabay.com/api/', {
        params: { key, q: query, per_page: perPage, safesearch: true, lang: 'zh' },
        timeout: 8000
      })
      return (res.data?.hits || []).map(p => ({
        url: p.webformatURL?.replace('_640', '_340'),
        original: p.largeImageURL || p.webformatURL,
        photographer: p.user,
        alt: p.tags || query
      }))
    }
  },
  pexels: {
    name: 'Pexels',
    builtin: false,
    quota: '200次/时',
    desc: '高质量摄影图片，需注册 Key',
    search: async (query, key, perPage) => {
      const res = await axios.get('https://api.pexels.com/v1/search', {
        headers: { Authorization: key },
        params: { query, per_page: perPage, locale: 'zh-CN' },
        timeout: 8000
      })
      return (res.data?.photos || []).map(p => ({
        url: p.src?.medium || p.src?.small,
        original: p.src?.original,
        photographer: p.photographer,
        alt: p.alt || query
      }))
    }
  },
  unsplash: {
    name: 'Unsplash',
    builtin: false,
    quota: '50次/时',
    desc: '精美创意图片，需注册 Key',
    search: async (query, key, perPage) => {
      const res = await axios.get('https://api.unsplash.com/search/photos', {
        headers: { Authorization: `Client-ID ${key}` },
        params: { query, per_page: perPage, lang: 'zh' },
        timeout: 8000
      })
      return (res.data?.results || []).map(p => ({
        url: p.urls?.small,
        original: p.urls?.full || p.urls?.raw,
        photographer: p.user?.name || 'Unknown',
        alt: p.alt_description || query
      }))
    }
  }
}

async function searchFromProvider(providerId, query, perPage = 3) {
  const provider = PROVIDERS[providerId]
  if (!provider) return { results: [], provider: providerId }

  const config = getProviderConfig(providerId)
  if (!config?.enabled) return { results: [], provider: providerId }
  if (!provider.builtin && !config?.key) return { results: [], provider: providerId }

  try {
    const results = await provider.search(query, config?.key, perPage)
    return { results, provider: providerId }
  } catch (e) {
    console.error(`[ImageSearch] ${providerId} failed:`, e.message)
    return { results: [], provider: providerId }
  }
}

async function searchImages(query, options = {}) {
  const perPage = options.perPage || 3
  const allProviders = options.providers || getProviderPriorityList()
  const activeProviders = allProviders.filter(id => {
    const cfg = getProviderConfig(id)
    if (!cfg?.enabled) return false
    const p = PROVIDERS[id]
    if (p?.builtin) return true
    return !!cfg?.key
  })

  if (activeProviders.length === 0) return []

  if (options.provider) {
    const r = await searchFromProvider(options.provider, query, perPage)
    return r.results
  }

  for (const pid of activeProviders) {
    const r = await searchFromProvider(pid, query, perPage)
    if (r.results.length > 0) {
      console.log(`[ImageSearch] ${pid} returned ${r.results.length} results for "${query}"`)
      return r.results
    }
  }

  return []
}

async function downloadImage(url, sourceProvider) {
  if (!url) return null
  const referers = [null]
  if (sourceProvider && REFERER_MAP[sourceProvider]) {
    referers.push(REFERER_MAP[sourceProvider])
  }
  for (const referer of referers) {
    try {
      const headers = {
        ...SCRAPER_HEADERS,
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate'
      }
      if (referer) headers.Referer = referer
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers
      })
      if (res.data?.length > 100) return Buffer.from(res.data)
    } catch (e) {
      if (referers.length > 1) console.error('[ImageSearch] download failed (referer=' + referer + '):', url?.slice(0, 60), e.message)
    }
  }
  return null
}

async function searchAndDownload(query, options = {}) {
  const perPage = options.perPage || 3
  const allProviders = options.providers || getProviderPriorityList()
  const activeProviders = allProviders.filter(id => {
    const cfg = getProviderConfig(id)
    if (!cfg?.enabled) return false
    const p = PROVIDERS[id]
    if (p?.builtin) return true
    return !!cfg?.key
  })

  const tryDownload = async (results, provider) => {
    for (const result of results) {
      const urls = [result.url]
      if (result.original && result.original !== result.url) urls.push(result.original)
      for (const url of urls) {
        if (!url) continue
        const buf = await downloadImage(url, provider)
        if (buf) return buf
      }
    }
    return null
  }

  if (options.provider) {
    const r = await searchFromProvider(options.provider, query, perPage)
    return await tryDownload(r.results, r.provider) || null
  }

  for (const pid of activeProviders) {
    const r = await searchFromProvider(pid, query, perPage)
    if (r.results.length > 0) {
      const buf = await tryDownload(r.results, r.provider)
      if (buf) return buf
    }
  }
  return null
}

function getDefaultPriority() {
  return ['bing', 'baidu', 'pixabay', 'pexels', 'unsplash']
}

function getProviderPriorityList() {
  const cfg = getProviderConfig('_priority')
  return cfg || getDefaultPriority()
}

function getProviderNames() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({ id, name: p.name, builtin: !!p.builtin }))
}

function hasBuiltinScraperEnabled() {
  const priority = getProviderPriorityList()
  return priority.some(id => {
    const p = PROVIDERS[id]
    if (!p?.builtin) return false
    const cfg = getProviderConfig(id)
    return cfg?.enabled !== false
  })
}

export {
  searchImages, downloadImage, searchAndDownload,
  searchFromProvider, getProviderPriorityList,
  getProviderNames, hasBuiltinScraperEnabled, getDefaultPriority
}

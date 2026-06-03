import axios from 'axios'
import { getImageGenConfig, getImageGenServerURL, getImageGenSubPriority } from '../config.js'

const GEN_PROVIDERS = {
  openai: {
    name: 'OpenAI DALL·E 3',
    endpoint: 'https://api.openai.com/v1/images/generations',
    defaultModel: 'dall-e-3',
    buildBody: (prompt, model) => ({ prompt, model: model || 'dall-e-3', n: 1, size: '1024x1024', quality: 'standard', response_format: 'b64_json' }),
    extractImage: (data) => data.data?.[0]?.b64_json || null,
    extractUrl: (data) => data.data?.[0]?.url || null
  },
  siliconflow: {
    name: '硅基流动',
    endpoint: 'https://api.siliconflow.cn/v1/images/generations',
    defaultModel: 'black-forest-labs/FLUX.1-dev',
    buildBody: (prompt, model) => ({ prompt, model: model || 'black-forest-labs/FLUX.1-dev', n: 1, size: '1024x1024', response_format: 'b64_json' }),
    extractImage: (data) => data.data?.[0]?.b64_json || null,
    extractUrl: (data) => data.data?.[0]?.url || null
  },
  server: {
    name: '自建服务端',
    endpoint: null,
    defaultModel: '',
    buildBody: (prompt, model) => {
      const body = { prompt, n: 1, response_format: 'b64_json' }
      if (model) body.model = model
      return body
    },
    extractImage: (data) => data.data?.[0]?.b64_json || data.images?.[0] || null,
    extractUrl: (data) => data.data?.[0]?.url || data.images?.[0]?.url || null
  },
  custom: {
    name: '自定义',
    endpoint: '',
    defaultModel: '',
    buildBody: (prompt, model) => ({ prompt, model: model || '', n: 1, response_format: 'b64_json' }),
    extractImage: (data) => data.data?.[0]?.b64_json || null,
    extractUrl: (data) => data.data?.[0]?.url || null
  }
}

export function getGenProviderList() {
  return Object.entries(GEN_PROVIDERS).map(([id, p]) => ({ id, name: p.name, defaultModel: p.defaultModel, endpoint: p.endpoint }))
}

export async function generateImage(prompt) {
  const config = getImageGenConfig()
  if (!config?.provider) return null

  const provider = GEN_PROVIDERS[config.provider]
  if (!provider) return null

  return tryGenerate(provider, config, prompt)
}

export async function generateImageWithFallback(prompt) {
  const config = getImageGenConfig()
  if (!config?.provider) return null
  const provider = GEN_PROVIDERS[config.provider]
  if (!provider) return null

  const subPriority = getImageGenSubPriority()

  // Server priority: try self-hosted server first, then configured provider
  if (subPriority === 'server' && config.provider !== 'server') {
    const serverProvider = GEN_PROVIDERS['server']
    const serverConfig = { provider: 'server' }
    const result = await tryGenerate(serverProvider, serverConfig, prompt)
    if (result) return result
  }

  return tryGenerate(provider, config, prompt)
}

async function tryGenerate(provider, config, prompt) {
  const isServer = config.provider === 'server'
  if (!isServer && !config?.key) return null

  try {
    let endpoint = isServer ? `${getImageGenServerURL()}/v1/images/generations` : (config.endpoint || provider.endpoint)
    const model = config.model || provider.defaultModel
    if (!endpoint) return null

    const body = provider.buildBody(prompt, model)
    const headers = { 'Content-Type': 'application/json' }
    if (!isServer && config.key) {
      headers['Authorization'] = `Bearer ${config.key}`
    }
    const res = await axios.post(endpoint, body, { headers, timeout: 120000, responseType: 'json' })

    const b64 = provider.extractImage(res.data)
    if (b64) {
      const buf = Buffer.from(b64, 'base64')
      if (buf.length > 100) return buf
    }

    const url = provider.extractUrl(res.data)
    if (url) {
      const imgRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })
      if (imgRes.data?.length > 100) return Buffer.from(imgRes.data)
    }

    return null
  } catch (e) {
    console.error('[ImageGen] error:', e.message)
    return null
  }
}

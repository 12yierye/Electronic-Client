import { getLMStudioAPI, getCloudAPIBase, getCloudAPIKey, getCloudModel } from '../config.js'

const COMPLEX_PATTERNS = [/(制作|生成|创建).*(课件|PPT|ppt|演示|教案)/, /(写一篇|撰写|编写|总结|翻译|分析)/, /(长篇|长文|文章|报告)/]
const LOCAL_PATTERNS = [/(发送|发给|通知|广播|查询|搜索|好友|联系人)/, /(几点|时间|在线|文件列表)/]

function isComplexTask(message) {
  return COMPLEX_PATTERNS.some(r => r.test(message))
}

function isLocalTask(message) {
  return LOCAL_PATTERNS.some(r => r.test(message))
}

async function checkLocalModelAvailable() {
  try {
    const { default: axios } = await import('axios')
    const res = await axios.get(`${getLMStudioAPI()}/models`, { timeout: 3000 })
    return res.data?.data?.length > 0
  } catch {
    return false
  }
}

async function checkCloudAvailable() {
  const key = getCloudAPIKey()
  if (!key) return false
  try {
    const { default: axios } = await import('axios')
    await axios.post(`${getCloudAPIBase()}/chat/completions`,
      { model: getCloudModel(), messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 },
      { headers: { Authorization: `Bearer ${key}` }, timeout: 5000 }
    )
    return true
  } catch (e) {
    return false
  }
}

async function route(message, preferredMode) {
  if (preferredMode === 'cloud') {
    const key = getCloudAPIKey()
    const model = getCloudModel()
    const base = getCloudAPIBase()
    console.log('[Router] cloud mode — key:', !!key, 'model:', model, 'base:', base)
    if (!key || !model || !base) {
      return {
        backend: 'none',
        reason: 'cloud_unavailable',
        error: '云端 API 未完整配置（需要 API Key、模型名和 API 地址）。请在设置中检查。'
      }
    }
    return {
      backend: 'cloud',
      apiUrl: `${base}/chat/completions`,
      model: model,
      apiKey: key,
      supportsTools: true,
      reason: 'user_prefers_cloud'
    }
  }

  if (preferredMode === 'local') {
    const localAvailable = await checkLocalModelAvailable()
    if (localAvailable) {
      return {
        backend: 'local',
        apiUrl: `${getLMStudioAPI()}/chat/completions`,
        model: null,
        supportsTools: true,
        reason: 'user_prefers_local'
      }
    }
    return {
      backend: 'none',
      reason: 'local_unavailable',
      error: '本地模型未启动，请打开 LM Studio 并加载模型。'
    }
  }

  // auto mode: original routing logic
  const localAvailable = await checkLocalModelAvailable()
  const cloudAvailable = await checkCloudAvailable()
  const isComplex = isComplexTask(message)
  const isLocal = isLocalTask(message)

  if (isLocal && localAvailable) {
    return {
      backend: 'local',
      apiUrl: `${getLMStudioAPI()}/chat/completions`,
      model: null,
      supportsTools: false,
      reason: 'local_task'
    }
  }

  if (isComplex && cloudAvailable) {
    return {
      backend: 'cloud',
      apiUrl: `${getCloudAPIBase()}/chat/completions`,
      model: getCloudModel(),
      apiKey: getCloudAPIKey(),
      supportsTools: true,
      reason: 'complex_cloud'
    }
  }

  if (localAvailable) {
    return {
      backend: 'local',
      apiUrl: `${getLMStudioAPI()}/chat/completions`,
      model: null,
      supportsTools: true,
      reason: 'default_local'
    }
  }

  if (cloudAvailable) {
    return {
      backend: 'cloud',
      apiUrl: `${getCloudAPIBase()}/chat/completions`,
      model: getCloudModel(),
      apiKey: getCloudAPIKey(),
      supportsTools: true,
      reason: 'fallback_cloud'
    }
  }

  return {
    backend: 'none',
    reason: 'no_model_available',
    error: '本地模型和云端 API 均不可用。'
  }
}

export { route, checkLocalModelAvailable }

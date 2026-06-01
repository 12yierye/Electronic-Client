export const cloudProviders = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', thinking: 'none', contextLimit: 1000000 },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', thinking: 'always', contextLimit: 1000000 }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', thinking: 'none', contextLimit: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', thinking: 'none', contextLimit: 128000 },
      { id: 'o3-mini', name: 'o3-mini', thinking: 'optional', contextLimit: 200000 },
      { id: 'o1', name: 'o1', thinking: 'always', contextLimit: 200000 }
    ]
  },
  {
    id: 'qwen',
    name: '通义千问',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-plus', name: 'Qwen Plus', thinking: 'none', contextLimit: 131072 },
      { id: 'qwen-max', name: 'Qwen Max', thinking: 'optional', contextLimit: 32768 },
      { id: 'qwen-turbo', name: 'Qwen Turbo', thinking: 'none', contextLimit: 1000000 },
      { id: 'qwen-long', name: 'Qwen Long', thinking: 'none', contextLimit: 10000000 }
    ]
  },
  {
    id: 'zhipu',
    name: '智谱AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash', thinking: 'none', contextLimit: 128000 },
      { id: 'glm-4', name: 'GLM-4', thinking: 'optional', contextLimit: 128000 },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', thinking: 'optional', contextLimit: 128000 }
    ]
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    baseURL: 'https://api.moonshot.cn/v1',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', thinking: 'none', contextLimit: 8192 },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', thinking: 'none', contextLimit: 32768 },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', thinking: 'none', contextLimit: 131072 }
    ]
  },
  {
    id: 'custom',
    name: '自定义',
    baseURL: '',
    models: []
  }
]

export function getProviderById(id) {
  return cloudProviders.find(p => p.id === id) || null
}

export function getProviderModels(providerId) {
  const p = getProviderById(providerId)
  return p ? p.models : []
}

export function getModelList(providerId) {
  const models = getProviderModels(providerId)
  return models.map(m => typeof m === 'string' ? { id: m, name: m } : m)
}

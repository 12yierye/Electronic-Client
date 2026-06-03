import { defineStore } from 'pinia'
import { ref } from 'vue'
import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// 配置marked选项 — 全面支持 GFM + KaTeX 公式
marked.use({
  breaks: true,
  gfm: true,
  pedantic: false,
  extensions: [{
    name: 'inlineMath',
    level: 'inline',
    start(src) { return src.indexOf('$') },
    tokenizer(src) {
      const match = src.match(/^(\$[^$\n]+?\$)/)
      if (match) {
        return { type: 'inlineMath', raw: match[0], formula: match[1].slice(1, -1) }
      }
    },
    renderer(token) {
      try { return katex.renderToString(token.formula, { displayMode: false, throwOnError: false }) }
      catch { return `<span>$${token.formula}$</span>` }
    }
  }, {
    name: 'blockMath',
    level: 'block',
    start(src) { return src.indexOf('$$') },
    tokenizer(src) {
      const match = src.match(/^\$\$([\s\S]+?)\$\$/)
      if (match) {
        return { type: 'blockMath', raw: match[0], formula: match[1].trim() }
      }
    },
    renderer(token) {
      try {
        const html = katex.renderToString(token.formula, { displayMode: true, throwOnError: false })
        return `<div class="katex-block" style="text-align:center;margin:12px 0;overflow-x:auto">${html}</div>`
      } catch { return `<div>$$${token.formula}$$</div>` }
    }
  }]
})

export const useAIStore = defineStore('ai', () => {
  const conversations = ref([])
  try {
    const raw = localStorage.getItem('ai_conversations')
    if (raw) conversations.value = JSON.parse(raw)
  } catch { conversations.value = [] }

  const activeConversationId = ref(localStorage.getItem('ai_active_conv') || '')

  function saveConversations() {
    try { localStorage.setItem('ai_conversations', JSON.stringify(conversations.value)) } catch {}
  }

  function initActiveConversation() {
    if (!activeConversationId.value || !conversations.value.find(c => c.id === activeConversationId.value)) {
      const conv = { id: Date.now().toString(), name: '新对话', messages: [], createdAt: Date.now() }
      conversations.value.unshift(conv)
      activeConversationId.value = conv.id
      saveConversations()
    }
    localStorage.setItem('ai_active_conv', activeConversationId.value)
  }

  initActiveConversation()

  function cloneMessages(arr) {
    try {
      if (!arr) return []
      const clean = arr.map(m => ({ id: m.id, role: m.role, type: m.type, content: m.content, thinking: m.thinking, timestamp: m.timestamp, fileName: m.fileName, filePath: m.filePath, slideCount: m.slideCount, pptxCard: m.pptxCard, imageGallery: m.imageGallery, question: m.question, options: m.options, answered: m.answered }))
      return JSON.parse(JSON.stringify(clean))
    } catch { return [] }
  }

  function safeClone(val) {
    try { return JSON.parse(JSON.stringify(val)) } catch { return val }
  }

  const activeConv = () => conversations.value.find(c => c.id === activeConversationId.value) || conversations.value[0]
  const messages = ref(cloneMessages(activeConv()?.messages))
  const isLoading = ref(false)

  // 恢复时重新生成 HTML 内容
  messages.value.forEach(m => {
    if (m.content && m.role === 'ai' && m.type !== 'pptx_card') {
      m.htmlContent = marked(m.content)
    }
  })
  const currentModel = ref('')
  const aiMode = ref(localStorage.getItem('aiMode') || 'local')
  const cloudModel = ref(localStorage.getItem('cloudModel') || 'gpt-4o')
  const cloudProvider = ref(localStorage.getItem('cloudProvider') || '')
  const contextTokens = ref(parseInt(localStorage.getItem('aiContextTokens')) || 32000)
  const planningMode = ref(localStorage.getItem('planningMode') === 'true')
  const enableThinking = ref(localStorage.getItem('enableThinking') === 'true')
  let currentStreamingMessage = null
  let messageIdCounter = 0

  const setContextTokens = (val) => {
    contextTokens.value = val
    localStorage.setItem('aiContextTokens', val)
  }

  const setPlanningMode = (val) => {
    planningMode.value = val
    localStorage.setItem('planningMode', val)
  }

  const setEnableThinking = (val) => {
    enableThinking.value = val
    localStorage.setItem('enableThinking', val)
  }

  const setAiMode = (mode) => {
    aiMode.value = mode
    localStorage.setItem('aiMode', mode)
  }

  const setCloudModel = (model) => {
    cloudModel.value = model
    localStorage.setItem('cloudModel', model)
    if (window.electronAPI?.setCloudModel) {
      window.electronAPI.setCloudModel(model)
    }
  }

  const setCloudProvider = (provider) => {
    cloudProvider.value = provider
    localStorage.setItem('cloudProvider', provider)
    if (window.electronAPI?.setCloudProvider) {
      window.electronAPI.setCloudProvider(provider)
    }
  }

  // 获取当前运行的模型
  const fetchCurrentModel = async () => {
    if (window.electronAPI?.getCurrentModel) {
      try {
        const result = await window.electronAPI.getCurrentModel()
        if (result.success) {
          currentModel.value = result.model
          console.log('[AI Store] model:', result.model)
        }
      } catch (e) {
        console.error('[AI Store] model fetch failed:', e)
      }
    }
  }

  // 生成唯一的消息ID
  const generateMessageId = () => {
    return Date.now() * 1000 + (++messageIdCounter % 1000)
  }

  // 添加用户消息
  const addUserMessage = (content) => {
    messages.value.push({
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    })
    persistCurrentConversation()
  }

  // 添加 AI 消息（支持Markdown和思考内容）
  const addAIMessage = (content, thinking = '') => {
    // 将Markdown转换为HTML
    const htmlContent = marked(content)
    messages.value.push({
      id: generateMessageId(),
      role: 'ai',
      content,
      htmlContent,
      thinking,
      showThinking: false,
      timestamp: new Date().toISOString()
    })
  }

  // 添加图片画廊到当前消息
  const addImageGallery = (data) => {
    const msg = currentStreamingMessage
      ? messages.value.find(m => m.id === currentStreamingMessage)
      : null
    const target = msg || messages.value[messages.value.length - 1]
    if (target && target.role === 'ai') {
      target.imageGallery = { images: data.images, query: data.query }
    }
  }

  // 添加 PPTX 卡片到当前消息（不创建新消息）
  const addPPTXCard = (data) => {
    const msg = currentStreamingMessage
      ? messages.value.find(m => m.id === currentStreamingMessage)
      : null
    const target = msg || messages.value[messages.value.length - 1]
    if (target && target.role === 'ai') {
      target.pptxCard = {
        fileName: data.fileName,
        filePath: data.path,
        slideCount: data.slideCount,
        message: data.message
      }
    }
  }

  // 添加规划问题气泡
  const addQuestionBubble = (question, options, multiSelect = false) => {
    messages.value.push({
      id: generateMessageId(),
      role: 'ai',
      type: 'question',
      question,
      options: (options || []).map(o => typeof o === 'string' ? { label: o } : o),
      multiSelect,
      answered: false,
      chosen: [],           // multi-select chosen labels
      customInput: '',       // 其他 input
      timestamp: new Date().toISOString()
    })
  }

  // 添加用户选择回答
  const addUserChoice = (questionId, answer) => {
    const q = messages.value.find(m => m.id === questionId)
    if (q) { q.answered = true; q.chosen = Array.isArray(answer) ? answer : [] }
    const answerText = Array.isArray(answer) ? answer.join('、') : String(answer)
    messages.value.push({
      id: generateMessageId(),
      role: 'user',
      type: 'choice',
      content: answerText,
      timestamp: new Date().toISOString()
    })
  }

  // 开始流式输出 - 创建新的 AI 消息占位
  const startStreamingMessage = (thinking = '') => {
    const id = generateMessageId()
    messages.value.push({
      id,
      role: 'ai',
      content: '',
      htmlContent: '',
      thinking,
      showThinking: true, // 默认展开思考内容
      timestamp: new Date().toISOString(),
      isStreaming: true
    })
    currentStreamingMessage = id
    return id
  }

  // 更新流式消息内容
  const updateStreamingMessage = (content) => {
    if (!currentStreamingMessage) return

    const msg = messages.value.find(m => m.id === currentStreamingMessage)
    if (msg) {
      msg.content = content
      msg.htmlContent = marked(content)
    }
  }

  // 结束流式输出
  const endStreamingMessage = () => {
    if (!currentStreamingMessage) return
    const msg = messages.value.find(m => m.id === currentStreamingMessage)
    if (msg) {
      msg.isStreaming = false
      msg.htmlContent = marked(msg.content)
    }
    currentStreamingMessage = null
    persistCurrentConversation()
  }

  // 追加流式内容
  const appendStreamingContent = (content) => {
    if (!currentStreamingMessage) return

    const msg = messages.value.find(m => m.id === currentStreamingMessage)
    if (msg) {
      msg.content += content
      msg.htmlContent = marked(msg.content)
    }
  }

  // 追加思考内容
  const appendReasoningContent = (reasoning) => {
    if (!currentStreamingMessage) return

    const msg = messages.value.find(m => m.id === currentStreamingMessage)
    if (msg) {
      msg.thinking = (msg.thinking || '') + reasoning
    }
  }

  // 切换思考内容显示
  const toggleThinking = (messageId) => {
    const msg = messages.value.find(m => m.id === messageId)
    if (msg) {
      msg.showThinking = !msg.showThinking
    }
  }
  
  // 清空消息
  const clearMessages = () => {
    messages.value = []
    const conv = activeConv()
    if (conv) { conv.messages = []; saveConversations() }
    currentStreamingMessage = null
  }

  // 切换对话
  const switchConversation = (id) => {
    // save current conversation
    const conv = activeConv()
    if (conv) conv.messages = safeClone(messages.value)

    localStorage.setItem('ai_active_conv', id)
    activeConversationId.value = id
    currentStreamingMessage = null
    messageIdCounter = 0

    const target = conversations.value.find(c => c.id === id)
    messages.value = cloneMessages(target?.messages)
    messages.value.forEach(m => {
      if (m.content && m.role === 'ai' && m.type !== 'pptx_card') {
        m.htmlContent = marked(m.content)
      }
    })
  }

  // 新建对话
  const newConversation = () => {
    const conv = activeConv()
    // 已在空对话中，不执行操作
    if (conv && (!conv.name || conv.name === '新对话') && (!conv.messages || conv.messages.length === 0)) {
      return
    }
    // 查找已有的空对话，存在则切换到该对话
    const existing = conversations.value.find(c => (!c.name || c.name === '新对话') && (!c.messages || c.messages.length === 0))
    if (existing) {
      if (conv) conv.messages = safeClone(messages.value)
      switchConversation(existing.id)
      return
    }
    if (conv) conv.messages = safeClone(messages.value)
    const newConv = { id: Date.now().toString(), name: '新对话', messages: [], createdAt: Date.now() }
    conversations.value.unshift(newConv)
    saveConversations()
    switchConversation(newConv.id)
  }

  // 对话自动命名
  const generateConversationTitle = async (firstMessage) => {
    if (!firstMessage || !window.electronAPI?.agentGenerateTitle) return
    const conv = activeConv()
    if (!conv || conv.name !== '新对话') return
    try {
      const { title } = await window.electronAPI.agentGenerateTitle(firstMessage)
      if (title) {
        conv.name = title
        saveConversations()
      }
    } catch {}
  }

  // 删除对话
  const deleteConversation = (id) => {
    conversations.value = conversations.value.filter(c => c.id !== id)
    saveConversations()
    if (activeConversationId.value === id) {
      if (conversations.value.length === 0) {
        const newConv = { id: Date.now().toString(), name: '新对话', messages: [], createdAt: Date.now() }
        conversations.value.push(newConv)
        saveConversations()
      }
      const target = conversations.value[0]
      activeConversationId.value = target.id
      currentStreamingMessage = null
      messageIdCounter = 0
      messages.value = cloneMessages(target.messages)
      messages.value.forEach(m => {
        if (m.content && m.role === 'ai' && m.type !== 'pptx_card') {
          m.htmlContent = marked(m.content)
        }
      })
      localStorage.setItem('ai_active_conv', target.id)
    }
  }

  // 重命名对话
  const renameConversation = (id, name) => {
    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      conv.name = name
      saveConversations()
    }
  }

  // 获取对话历史（用于注入 LLM 请求）
  const getConversationHistory = (maxTokens = 3000) => {
    const history = []
    let tokenCount = 0
    const msgs = [...messages.value].reverse()
    for (const msg of msgs) {
      if (msg.isStreaming || msg.pptxCard) continue
      const text = msg.content || ''
      const estimatedTokens = Math.ceil(text.length / 3)
      if (tokenCount + estimatedTokens > maxTokens) break
      history.unshift({ role: msg.role, content: text })
      tokenCount += estimatedTokens
    }
    return history
  }

  // 获取问候语
  const getGreeting = () => {
    const hour = new Date().getHours()
    const lang = localStorage.getItem('appSettings')
      ? JSON.parse(localStorage.getItem('appSettings')).language || 'zh-CN'
      : localStorage.getItem('appLanguage') || 'zh-CN'
    
    const greetings = {
      'zh-CN': {
        morning: '早上好！',
        afternoon: '下午好！',
        evening: '晚上好！',
        night: '晚安！'
      },
      en: {
        morning: 'Good morning!',
        afternoon: 'Good afternoon!',
        evening: 'Good evening!',
        night: 'Good night!'
      },
      ja: {
        morning: 'おはようございます！',
        afternoon: 'こんにちは！',
        evening: 'こんばんは！',
        night: 'おやすみなさい！'
      }
    }
    
    const langGreetings = greetings[lang] || greetings['zh-CN']
    
    if (hour >= 6 && hour < 12) return langGreetings.morning
    if (hour >= 12 && hour < 18) return langGreetings.afternoon
    if (hour >= 18 && hour < 21) return langGreetings.evening
    return langGreetings.night
  }

  // 保存当前对话到 localStorage（仅在稳定状态调用）
  function persistCurrentConversation() {
    const conv = activeConv()
    if (!conv) return
    conv.messages = safeClone(messages.value)
    if (messages.value.length > 0 && conv.name === '新对话') {
      const firstUser = messages.value.find(m => m.role === 'user')
      if (firstUser) conv.name = firstUser.content.slice(0, 30)
    }
    saveConversations()
  }

  return {
    messages,
    conversations,
    activeConversationId,
    isLoading,
    currentModel,
    aiMode,
    cloudModel,
    cloudProvider,
    contextTokens,
    planningMode,
    fetchCurrentModel,
    setAiMode,
    setCloudModel,
    setCloudProvider,
    setContextTokens,
    setPlanningMode,
    enableThinking,
    setEnableThinking,
    addUserMessage,
    addAIMessage,
    addPPTXCard,
    addQuestionBubble,
    addUserChoice,
    startStreamingMessage,
    updateStreamingMessage,
    appendStreamingContent,
    appendReasoningContent,
    endStreamingMessage,
    toggleThinking,
    clearMessages,
    switchConversation,
    newConversation,
    generateConversationTitle,
    deleteConversation,
    renameConversation,
    getConversationHistory,
    getGreeting,
    persistCurrentConversation
  }
})

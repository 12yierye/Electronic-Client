import { defineStore } from 'pinia'
import { ref } from 'vue'
import { marked } from 'marked'

// 配置marked选项
marked.setOptions({
  breaks: true,
  gfm: true
})

export const useAIStore = defineStore('ai', () => {
  const messages = ref([])
  const isLoading = ref(false)
  const currentModel = ref('') // 当前运行的模型
  let currentStreamingMessage = null // 当前正在流式输出的消息
  let messageIdCounter = 0 // 消息ID计数器，确保唯一性

  // 获取当前运行的模型
  const fetchCurrentModel = async () => {
    if (window.electronAPI?.getCurrentModel) {
      try {
        const result = await window.electronAPI.getCurrentModel()
        if (result.success) {
          currentModel.value = result.model
          console.log('[AI Store] 当前模型:', result.model)
        }
      } catch (e) {
        console.error('[AI Store] 获取模型失败:', e)
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
      // 强制更新htmlContent以确保响应式更新正确触发
      msg.htmlContent = marked(msg.content)
    }
    currentStreamingMessage = null
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
  }
  
  // 获取问候语
  const getGreeting = () => {
    const hour = new Date().getHours()
    const lang = localStorage.getItem('appSettings')
      ? JSON.parse(localStorage.getItem('appSettings')).language || 'en'
      : 'en'
    
    const greetings = {
      en: {
        morning: 'Good morning!',
        afternoon: 'Good afternoon!',
        evening: 'Good evening!',
        night: 'Good night!'
      },
      zh: {
        morning: '早上好！',
        afternoon: '下午好！',
        evening: '晚上好！',
        night: '晚安！'
      }
    }
    
    const langGreetings = greetings[lang] || greetings.en
    
    if (hour >= 6 && hour < 12) return langGreetings.morning
    if (hour >= 12 && hour < 18) return langGreetings.afternoon
    if (hour >= 18 && hour < 21) return langGreetings.evening
    return langGreetings.night
  }
  
  return {
    messages,
    isLoading,
    currentModel,
    fetchCurrentModel,
    addUserMessage,
    addAIMessage,
    startStreamingMessage,
    updateStreamingMessage,
    appendStreamingContent,
    appendReasoningContent,
    endStreamingMessage,
    toggleThinking,
    clearMessages,
    getGreeting
  }
})

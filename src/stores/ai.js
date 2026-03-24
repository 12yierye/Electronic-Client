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
  
  // 添加用户消息
  const addUserMessage = (content) => {
    messages.value.push({
      id: Date.now(),
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
      id: Date.now(),
      role: 'ai',
      content,
      htmlContent,
      thinking,
      showThinking: false,
      timestamp: new Date().toISOString()
    })
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
    addUserMessage,
    addAIMessage,
    toggleThinking,
    clearMessages,
    getGreeting
  }
})

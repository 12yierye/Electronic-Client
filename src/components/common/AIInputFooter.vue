<template>
  <div class="ai-input-footer">
    <el-input
      v-model="inputMessage"
      type="textarea"
      :placeholder="t('aiChat.enterToSend')"
      :rows="1"
      autosize
      :disabled="isSending"
      @keydown.enter.exact="handleEnterKey"
      @keydown.shift.enter="handleNewLine"
    />
    <el-button
      v-if="isSending"
      type="danger"
      :icon="Close"
      @click="handleCancel"
    >
      停止
    </el-button>
    <el-button 
      v-else
      type="primary" 
      :icon="Promotion" 
      @click="handleSend"
      :disabled="!inputMessage.trim()"
    >
      {{ t('common.send') }}
    </el-button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Promotion, Loading, Close } from '@element-plus/icons-vue'
import { useAIStore } from '../../stores/ai'
import { useI18n } from '../../composables/useI18n'
import { useUserStore } from '../../stores/user'
import { parseScheduledIntent, executeFunctionCall } from '../../composables/useScheduledTask'

const aiStore = useAIStore()
const userStore = useUserStore()
const { t } = useI18n()
const inputMessage = ref('')
const isSending = ref(false)

const handleEnterKey = (e) => {
  e.preventDefault()
  const message = inputMessage.value.trim()
  if (!message || isSending.value) return
  handleSend()
}

const handleTestImage = async (query) => {
  isSending.value = true
  aiStore.addUserMessage('/test-image ' + query)
  inputMessage.value = ''
  const msgId = aiStore.startStreamingMessage()
  try {
    const res = await window.electronAPI.testImageSearch(query, 'all')
    if (res?.success && res.count > 0) {
      const lines = [`**图片搜索结果** — 关键词: "${query}"`, ``, `✅ 找到 ${res.count} 张图片 (${res.time}ms)`]
      if (res.firstUrl) {
        lines.push(``, `第一张: `, ``, `![](${res.firstUrl})`)
      }
      res.images.slice(1).forEach((img, i) => {
        if (img.url) lines.push(``, `${i + 2}. ${img.url}`)
      })
      aiStore.appendStreamingContent(lines.join('\n'))
    } else if (res?.success) {
      aiStore.appendStreamingContent(`**图片搜索** — 关键词: "${query}"\n\n未找到匹配图片 (${res.time}ms)。\n\n> 提示：如需获取真实图片，请在设置→文件管理→Pexels API Key 中配置密钥。`)
    } else {
      aiStore.appendStreamingContent(`**图片搜索失败**\n\n${res?.message || '未知错误'}\n\n请在设置→文件管理→Pexels API Key 中配置密钥。`)
    }
  } catch (e) {
    aiStore.appendStreamingContent(`**图片搜索异常**\n\n${e.message}`)
  }
  aiStore.endStreamingMessage()
  aiStore.persistCurrentConversation()
  isSending.value = false
}

const handleSend = async () => {
  const message = inputMessage.value.trim()
  if (!message || isSending.value) return

  const testImgMatch = message.match(/^\/test-image\s+(.+)/)
  if (testImgMatch && window.electronAPI?.testImageSearch) {
    return handleTestImage(testImgMatch[1])
  }

  const currentUsername = userStore.userInfo?.username
  const currentMode = localStorage.getItem('aiMode') || aiStore.aiMode || 'local'

  isSending.value = true
  aiStore.addUserMessage(message)
  inputMessage.value = ''

  const isComplex = /(课件|PPT|制作|生成|通知|群发|发到|发给所有|全部).*/.test(message) || message.length > 80

  if ((isComplex || currentMode === 'cloud' || aiStore.planningMode) && window.electronAPI.agentRun) {
    await handleAgentSend(message, currentUsername, currentMode)
  } else {
    await handleStreamingSend(message, currentUsername)
  }
}

const handleAgentSend = async (message, currentUsername, currentMode) => {
  if (window.electronAPI.removeAgentListeners) {
    window.electronAPI.removeAgentListeners()
  }

  aiStore.startStreamingMessage()
  const mode = currentMode || localStorage.getItem('aiMode') || 'local'
  let routingLogged = false

  if (window.electronAPI.onAgentProgress) {
    window.electronAPI.onAgentProgress((data) => {
      if (data.type === 'routing') {
        if (!routingLogged) { aiStore.appendReasoningContent(`[${data.backend}] `); routingLogged = true }
      }
      else if (data.type === 'tool_call') aiStore.appendReasoningContent(`\n→ ${data.tool}...`)
      else if (data.type === 'tool_result') aiStore.appendReasoningContent(data.success ? ' ✓' : ' ✗')
      else if (data.type === 'error') aiStore.appendReasoningContent(`\n错误: ${data.message}`)
    })
  }

  if (window.electronAPI.onAgentChunk) {
    window.electronAPI.onAgentChunk((data) => {
      if (data.type === 'content') aiStore.appendStreamingContent(data.content)
      else if (data.type === 'reasoning') aiStore.appendReasoningContent(data.content)
      else if (data.type === 'pptx_card') aiStore.addPPTXCard(data)
      else if (data.type === 'image_gallery') aiStore.addImageGallery(data)
      else if (data.type === 'question') {
        aiStore.endStreamingMessage()
        aiStore.addQuestionBubble(data.question, data.options, data.multiSelect)
        isSending.value = false
      }
    })
  }

  try {
    const cloudRaw = localStorage.getItem('cloudApiSettings')
    let cloudConfig = {}
    if (cloudRaw) {
      try { const c = JSON.parse(cloudRaw); cloudConfig = { base: c.base, key: c.key, model: c.model, provider: c.provider } } catch {}
    }
    const history = aiStore.getConversationHistory ? aiStore.getConversationHistory(aiStore.contextTokens) : []
    const pptCards = (aiStore.messages || []).filter(m => m.pptxCard).map(m => m.pptxCard)
    const result = await window.electronAPI.agentRun({ message, aiMode: mode, cloudConfig, history, pptCards, planningMode: aiStore.planningMode, enableThinking: aiStore.enableThinking, locale: localStorage.getItem('appLanguage') || 'zh-CN' })
    if (result.reply && result.reply.trim()) {
      aiStore.appendStreamingContent(result.reply)
    }
    if (result.cancelled) aiStore.appendStreamingContent('\n[已中断]')
    aiStore.endStreamingMessage()
    aiStore.persistCurrentConversation()
    aiStore.generateConversationTitle(message)
  } catch (error) {
    aiStore.endStreamingMessage()
    aiStore.addAIMessage('异常：' + error.message)
  } finally {
    isSending.value = false
    if (window.electronAPI.removeAgentListeners) {
      window.electronAPI.removeAgentListeners()
    }
  }
}

const handleCancel = async () => {
  if (window.electronAPI.agentCancel) {
    await window.electronAPI.agentCancel()
  }
  aiStore.endStreamingMessage()
  aiStore.persistCurrentConversation()
  isSending.value = false
}

const handleStreamingSend = async (message, currentUsername) => {
  let streamEndedNormally = false

  if (window.electronAPI.removeAIChatStreamListener) {
    window.electronAPI.removeAIChatStreamListener()
  }

  if (window.electronAPI.onAIChatStreamChunk) {
    window.electronAPI.onAIChatStreamChunk((data) => {
      if (data.functionCall) {
        console.log('[AI] function call:', data.functionCall)

        const params = parseScheduledIntent(message)

        if (params) {
          let scheduleTime = null
          let timeStr = ''

          if (params.time) {
            const [hours, minutes] = params.time.split(':').map(Number)
            const now = new Date()
            let scheduleDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0)
            if (scheduleDate <= now) {
              scheduleDate.setDate(scheduleDate.getDate() + 1)
            }
            scheduleTime = scheduleDate.toISOString()
            timeStr = `${scheduleDate.getHours().toString().padStart(2, '0')}:${scheduleDate.getMinutes().toString().padStart(2, '0')}`
          } else if (params.minutesLater) {
            const now = new Date()
            now.setMinutes(now.getMinutes() + params.minutesLater)
            scheduleTime = now.toISOString()
            timeStr = t('aiChat.minutesLater', { n: params.minutesLater })
          }

          executeFunctionCall(data.functionCall, params, scheduleTime, timeStr, currentUsername, message, aiStore, t)
        } else {
          aiStore.endStreamingMessage()
          aiStore.addUserMessage(message)
          aiStore.addAIMessage(t('aiChat.formatHelp'))
        }
        return
      }

      if (data.done) {
        streamEndedNormally = true
        aiStore.endStreamingMessage()
        aiStore.persistCurrentConversation()
        aiStore.generateConversationTitle(message)
        isSending.value = false
        if (window.electronAPI.removeAIChatStreamListener) {
          window.electronAPI.removeAIChatStreamListener()
        }
      } else {
        if (data.reasoning) aiStore.appendReasoningContent(data.reasoning)
        if (data.content) aiStore.appendStreamingContent(data.content)
      }
    })
  }

  try {
    console.log('[AI] stream start:', message.substring(0, 60))
    aiStore.startStreamingMessage()

    const result = await window.electronAPI.aiChatStream(message)
    console.log('[AI] stream result:', result.success)

    if (!result.success) {
      aiStore.endStreamingMessage()
      aiStore.addAIMessage(t('aiChat.aiFailed') + result.message)
    }
  } catch (error) {
    aiStore.endStreamingMessage()
    aiStore.addAIMessage(t('aiChat.aiConnectionFailed') + error.message)
  } finally {
    if (!streamEndedNormally) {
      isSending.value = false
    }
  }
}

onUnmounted(() => {
  if (window.electronAPI.removeAIChatStreamListener) {
    window.electronAPI.removeAIChatStreamListener()
  }
  window.removeEventListener('planning-send', handlePlanningSend)
})

const handleNewLine = () => {}

function handlePlanningSend(e) {
  const { message, currentUsername, currentMode } = e.detail
  if (!message || isSending.value) return
  isSending.value = true
  handleAgentSend(message, currentUsername, currentMode)
}

onMounted(() => {
  window.addEventListener('planning-send', handlePlanningSend)
})
</script>

<style lang="scss" scoped>
.ai-input-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 15px 30px;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  
  .el-textarea {
    flex: 1;
    min-height: 40px;
    
    :deep(.el-textarea__inner) {
      border-radius: 20px;
      padding: 10px 20px;
      resize: none;
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--text-secondary);
      line-height: 1.5;
      min-height: 40px;
      max-height: 120px;
      transition: all 0.3s ease;
      
      &:focus {
        border-color: var(--accent-color);
      }
    }
  }
  
  .el-button {
    height: 40px;
    padding: 0 20px;
    flex-shrink: 0;
    border-radius: 20px;
    font-weight: 500;
    
    :deep(.el-icon) {
      margin-right: 6px;
      font-size: 16px;
    }
  }
}
</style>

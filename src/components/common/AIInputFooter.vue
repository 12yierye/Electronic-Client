<template>
  <div class="ai-input-footer">
    <el-input
      v-model="inputMessage"
      type="textarea"
      :placeholder="t('aiChat.enterToSend')"
      :rows="1"
      autosize
      :disabled="aiStore.isLoading"
      @keydown.enter.exact="handleEnterKey"
      @keydown.shift.enter="handleNewLine"
    />
    <el-button 
      type="primary" 
      :icon="isSending ? Loading : Promotion" 
      @click="handleSend"
      :disabled="!inputMessage.trim() || aiStore.isLoading"
    >
      {{ isSending ? t('aiChat.thinking') : t('common.send') }}
    </el-button>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { Promotion, Loading } from '@element-plus/icons-vue'
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

const handleSend = async () => {
  const message = inputMessage.value.trim()
  if (!message || isSending.value) return

  const currentUsername = userStore.userInfo?.username

  isSending.value = true
  aiStore.addUserMessage(message)
  inputMessage.value = ''

  if (window.electronAPI.removeAIChatStreamListener) {
    window.electronAPI.removeAIChatStreamListener()
  }

  let streamEndedNormally = false

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
      if (window.electronAPI.removeAIChatStreamListener) {
        window.electronAPI.removeAIChatStreamListener()
      }
    }
  }
}

onUnmounted(() => {
  if (window.electronAPI.removeAIChatStreamListener) {
    window.electronAPI.removeAIChatStreamListener()
  }
})

const handleNewLine = () => {}
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

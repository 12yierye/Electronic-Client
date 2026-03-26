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

const aiStore = useAIStore()
const { t } = useI18n()
const inputMessage = ref('')
const isSending = ref(false)

// 按Enter发送消息，空消息时不换行
const handleEnterKey = (e) => {
  e.preventDefault() // 阻止默认换行行为
  const message = inputMessage.value.trim()
  if (!message || isSending.value) return

  // 有消息时调用发送
  handleSend()
}

const handleSend = async () => {
  const message = inputMessage.value.trim()
  if (!message || isSending.value) return

  isSending.value = true
  aiStore.addUserMessage(message)
  inputMessage.value = ''

  // 先清理旧的监听器，再设置新的
  if (window.electronAPI.removeAIChatStreamListener) {
    window.electronAPI.removeAIChatStreamListener()
  }

  // 设置流式监听器
  if (window.electronAPI.onAIChatStreamChunk) {
    window.electronAPI.onAIChatStreamChunk((data) => {
      if (data.done) {
        // 流结束
        aiStore.endStreamingMessage()
      } else {
        // 追加思考内容
        if (data.reasoning) {
          aiStore.appendReasoningContent(data.reasoning)
        }
        // 追加流式内容
        if (data.content) {
          aiStore.appendStreamingContent(data.content)
        }
      }
    })
  }

  // 调用本地 AI 模型流式回复
  try {
    console.log('[Renderer] 调用 aiChatStream，消息:', message)

    // 先创建空的 AI 消息占位
    aiStore.startStreamingMessage()

    const result = await window.electronAPI.aiChatStream(message)
    console.log('[Renderer] aiChatStream 返回:', result)

    if (!result.success) {
      // 流式失败，添加错误消息
      aiStore.endStreamingMessage()
      aiStore.addAIMessage('抱歉，AI 响应失败: ' + result.message)
    }
    // 如果成功，流式监听器会自动处理
  } catch (error) {
    aiStore.endStreamingMessage()
    aiStore.addAIMessage('抱歉，连接 AI 失败: ' + error.message)
  } finally {
    isSending.value = false
    // 清理监听器
    if (window.electronAPI.removeAIChatStreamListener) {
      window.electronAPI.removeAIChatStreamListener()
    }
  }
}

// 组件卸载时清理监听器
onUnmounted(() => {
  if (window.electronAPI.removeAIChatStreamListener) {
    window.electronAPI.removeAIChatStreamListener()
  }
})

const handleNewLine = () => {
  // Shift + Enter 允许换行
}
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

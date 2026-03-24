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
import { ref } from 'vue'
import { Promotion, Loading } from '@element-plus/icons-vue'
import { useAIStore } from '../../stores/ai'
import { useI18n } from '../../composables/useI18n'

const aiStore = useAIStore()
const { t } = useI18n()
const inputMessage = ref('')
const isSending = ref(false)

// 按Enter发送消息，空消息时不换行
const handleEnterKey = (e) => {
  const message = inputMessage.value.trim()
  if (!message) {
    e.preventDefault() // 空消息时阻止换行
    return
  }
  // 有消息时调用发送
  handleSend()
}

const handleSend = async () => {
  const message = inputMessage.value.trim()
  if (!message || isSending.value) return
  
  isSending.value = true
  aiStore.addUserMessage(message)
  inputMessage.value = ''
  
  // 调用本地 AI 模型回复
  try {
    console.log('[Renderer] 调用 aiChat，消息:', message)
    const result = await window.electronAPI.aiChat(message)
    console.log('[Renderer] aiChat 返回:', result)
    if (result.success) {
      // 支持思考内容和Markdown
      aiStore.addAIMessage(result.reply, result.thinking || '')
    } else {
      aiStore.addAIMessage('抱歉，AI 响应失败: ' + result.message)
    }
  } catch (error) {
    aiStore.addAIMessage('抱歉，连接 AI 失败: ' + error.message)
  } finally {
    isSending.value = false
  }
}

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

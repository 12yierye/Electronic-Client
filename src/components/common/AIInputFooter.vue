<template>
  <div class="ai-input-footer">
    <el-input
      v-model="inputMessage"
      type="textarea"
      :placeholder="t('aiChat.enterToSend')"
      :rows="1"
      autosize
      @keydown.enter.exact="handleSend"
      @keydown.shift.enter="handleNewLine"
    />
    <el-button 
      type="primary" 
      :icon="Promotion" 
      @click="handleSend"
      :disabled="!inputMessage.trim()"
    >{{ t('common.send') }}</el-button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Promotion } from '@element-plus/icons-vue'
import { useAIStore } from '../../stores/ai'
import { useI18n } from '../../composables/useI18n'

const aiStore = useAIStore()
const { t } = useI18n()
const inputMessage = ref('')

const handleSend = () => {
  const message = inputMessage.value.trim()
  if (!message) return
  
  aiStore.addUserMessage(message)
  inputMessage.value = ''
  
  // 模拟 AI 回复
  setTimeout(() => {
    aiStore.addAIMessage(t('aiChat.aiResponse'))
  }, 1000)
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

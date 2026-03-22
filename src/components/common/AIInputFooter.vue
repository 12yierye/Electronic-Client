<<<<<<< HEAD
<template>
  <div class="ai-input-footer">
    <el-input
      v-model="inputMessage"
      type="textarea"
      placeholder="按 Enter 发送消息..."
      :rows="1"
      autosize
      @keydown.enter.exact="handleSend"
      @keydown.shift.enter="handleNewLine"
    />
    <el-button 
      type="primary" 
      :icon="Promotion" 
      circle 
      @click="handleSend"
      :disabled="!inputMessage.trim()"
    />
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { Promotion } from '@element-plus/icons-vue'
import { useAIStore } from '../../stores/ai'

const aiStore = useAIStore()
const inputMessage = ref('')

const emit = defineEmits(['send'])

const handleSend = () => {
  const message = inputMessage.value.trim()
  if (!message) return
  
  aiStore.addUserMessage(message)
  inputMessage.value = ''
  
  // 模拟 AI 回复
  setTimeout(() => {
    aiStore.addAIMessage('这是AI的回复内容，可能与真实答案有所偏差，请谅解。')
  }, 1000)
}

const handleNewLine = (e) => {
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
  align-items: flex-end;
  gap: 15px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  
  .el-textarea {
    flex: 1;
    
    :deep(.el-textarea__inner) {
      border-radius: 20px;
      padding: 12px 20px;
      resize: none;
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--text-secondary);
      
      &:focus {
        border-color: var(--accent-color);
      }
    }
  }
}
</style>
=======
<template>
  <div class="ai-input-footer">
    <el-input
      v-model="inputMessage"
      type="textarea"
      placeholder="按 Enter 发送消息..."
      :rows="1"
      autosize
      @keydown.enter.exact="handleSend"
      @keydown.shift.enter="handleNewLine"
    />
    <el-button 
      type="primary" 
      :icon="Promotion" 
      circle 
      @click="handleSend"
      :disabled="!inputMessage.trim()"
    />
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { Promotion } from '@element-plus/icons-vue'
import { useAIStore } from '../../stores/ai'

const aiStore = useAIStore()
const inputMessage = ref('')

const emit = defineEmits(['send'])

const handleSend = () => {
  const message = inputMessage.value.trim()
  if (!message) return
  
  aiStore.addUserMessage(message)
  inputMessage.value = ''
  
  // 模拟 AI 回复
  setTimeout(() => {
    aiStore.addAIMessage('这是AI的回复内容，可能与真实答案有所偏差，请谅解。')
  }, 1000)
}

const handleNewLine = (e) => {
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
  align-items: flex-end;
  gap: 15px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  
  .el-textarea {
    flex: 1;
    
    :deep(.el-textarea__inner) {
      border-radius: 20px;
      padding: 12px 20px;
      resize: none;
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--text-secondary);
      
      &:focus {
        border-color: var(--accent-color);
      }
    }
  }
}
</style>
>>>>>>> f3dad1cfcc8f087826bc135228a1a3df7c24437e

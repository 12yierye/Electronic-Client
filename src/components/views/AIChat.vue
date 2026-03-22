<template>
  <div class="ai-chat-view">
    <!-- 欢迎/问候语 -->
    <div v-if="messages.length === 0" class="welcome-section">
      <el-icon class="ai-icon" :size="60"><MagicStick /></el-icon>
      <h2>Electronic</h2>
      <p class="intro">您的个人AI助手</p>
      <p class="greeting">{{ greeting }}</p>
    </div>
    
    <!-- 消息列表 -->
    <div v-else class="messages-container" ref="messagesContainer">
      <transition-group name="message">
        <div 
          v-for="msg in messages" 
          :key="msg.id"
          :class="['message-item', msg.role]"
        >
          <el-avatar 
            :size="40" 
            :src="msg.role === 'user' ? userAvatar : aiAvatar"
          >
            {{ msg.role === 'user' ? 'U' : 'AI' }}
          </el-avatar>
          <div class="message-content">
            <div class="message-bubble">
              {{ msg.content }}
            </div>
          </div>
        </div>
      </transition-group>
    </div>
    
    <!-- 错误提示 -->
    <el-alert
      v-if="showError"
      title="请输入内容"
      type="warning"
      show-icon
      closable
      @close="showError = false"
      class="error-alert"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'
import { useAIStore } from '../../stores/ai'

const aiStore = useAIStore()

const messagesContainer = ref(null)
const showError = ref(false)

const messages = computed(() => aiStore.messages)
const greeting = computed(() => aiStore.getGreeting())
const userAvatar = ref('')
const aiAvatar = ref('')

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(messages, () => {
  scrollToBottom()
}, { deep: true })

onMounted(() => {
  scrollToBottom()
})
</script>

<style lang="scss" scoped>
.ai-chat-view {
  min-height: calc(100vh - 120px);
  padding: 20px 30px 100px;
  overflow-y: auto;
  
  .welcome-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
    
    .ai-icon {
      color: var(--accent-color);
      margin-bottom: 20px;
    }
    
    h2 {
      font-size: 36px;
      margin: 0 0 10px;
      color: var(--text-primary);
    }
    
    .intro {
      font-size: 16px;
      color: var(--text-secondary);
      margin: 0 0 20px;
    }
    
    .greeting {
      font-size: 20px;
      color: var(--accent-color);
      font-weight: 500;
    }
  }
  
  .messages-container {
    max-width: 800px;
    margin: 0 auto;
    
    .message-item {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      
      &.user {
        flex-direction: row-reverse;
        
        .message-bubble {
          background: var(--accent-color);
          color: white;
        }
      }
      
      &.ai {
        .message-bubble {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
      }
      
      .message-content {
        max-width: 70%;
        
        .message-bubble {
          padding: 12px 18px;
          border-radius: 18px;
          line-height: 1.5;
          word-break: break-word;
        }
      }
    }
  }
  
  .error-alert {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
  }
}

.message-enter-active {
  transition: all 0.3s ease;
}

.message-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
</style>

<template>
  <div class="ai-chat-view">
    <!-- 欢迎/问候语 -->
    <div v-if="messages.length === 0" class="welcome-section">
      <el-icon class="ai-icon" :size="60"><MagicStick /></el-icon>
      <h2>Electronic</h2>
      <p class="intro">{{ t('aiChat.personalAssistant') }}</p>
      <p class="greeting">{{ greeting }}</p>
      <p v-if="aiStore.currentModel" class="current-model">
        <el-tag type="info" effect="plain">
          <el-icon class="model-icon"><Monitor /></el-icon>
          {{ aiStore.currentModel }}
        </el-tag>
      </p>
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
            <!-- 思考内容（仅AI消息） -->
            <div v-if="msg.thinking" class="thinking-section">
              <div 
                class="thinking-toggle" 
                @click="aiStore.toggleThinking(msg.id)"
              >
                <el-icon>
                  <ArrowDown v-if="msg.showThinking" />
                  <ArrowRight v-else />
                </el-icon>
                <span>思考中...</span>
              </div>
              <div v-if="msg.showThinking" class="thinking-content">
                <pre>{{ msg.thinking }}</pre>
              </div>
            </div>
            
            <!-- 消息内容 - 支持Markdown -->
            <div class="message-bubble" :class="{ 'is-html': msg.htmlContent }">
              <template v-if="msg.htmlContent">
                <div class="markdown-content" v-html="msg.htmlContent"></div>
              </template>
              <template v-else>
                {{ msg.content }}
              </template>
            </div>
          </div>
        </div>
      </transition-group>
    </div>
    
    <!-- 错误提示 -->
    <el-alert
      v-if="showError"
      :title="t('aiChat.inputRequired')"
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
import { MagicStick, ArrowDown, ArrowRight, Monitor } from '@element-plus/icons-vue'
import { useAIStore } from '../../stores/ai'
import { useI18n } from '../../composables/useI18n'

const aiStore = useAIStore()
const { t } = useI18n()

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
  // 获取当前运行的模型
  aiStore.fetchCurrentModel()
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

    .current-model {
      margin-top: 12px;

      .el-tag {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        padding: 8px 16px;

        .model-icon {
          font-size: 16px;
        }
      }
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
        // 确保ai样式不被user覆盖
        flex-direction: row !important;
        
        .message-bubble {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
        
        .thinking-section {
          margin-bottom: 8px;
          
          .thinking-toggle {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            width: fit-content;
            
            &:hover {
              background: var(--bg-secondary);
            }
          }
          
          .thinking-content {
            background: var(--bg-secondary);
            border-radius: 8px;
            padding: 12px;
            margin-top: 4px;
            
            pre {
              margin: 0;
              white-space: pre-wrap;
              font-family: monospace;
              font-size: 12px;
              color: var(--text-secondary);
            }
          }
        }
      }
      
      .message-content {
        max-width: 70%;
        
        .message-bubble {
          padding: 12px 18px;
          border-radius: 18px;
          line-height: 1.5;
          word-break: break-word;
          
          &.is-html {
            padding: 12px 18px;
          }
          
          // Markdown 样式
          :deep(.markdown-content) {
            p {
              margin: 0 0 8px;
              &:last-child {
                margin-bottom: 0;
              }
            }
            
            code {
              background: rgba(0, 0, 0, 0.1);
              padding: 2px 6px;
              border-radius: 4px;
              font-family: monospace;
              font-size: 0.9em;
            }
            
            pre {
              background: rgba(0, 0, 0, 0.1);
              padding: 12px;
              border-radius: 8px;
              overflow-x: auto;
              margin: 8px 0;
              
              code {
                background: none;
                padding: 0;
              }
            }
            
            ul, ol {
              padding-left: 20px;
              margin: 8px 0;
            }
            
            a {
              color: var(--accent-color);
              text-decoration: none;
              &:hover {
                text-decoration: underline;
              }
            }
            
            blockquote {
              border-left: 3px solid var(--accent-color);
              margin: 8px 0;
              padding-left: 12px;
              color: var(--text-secondary);
            }
            
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 8px 0;
              
              th, td {
                border: 1px solid var(--text-secondary);
                padding: 8px;
                text-align: left;
              }
              
              th {
                background: rgba(0, 0, 0, 0.1);
              }
            }
          }
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

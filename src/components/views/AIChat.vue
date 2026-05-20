<template>
  <div class="ai-chat-view" ref="chatViewRef" @scroll="onScroll">
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
    <div v-else class="messages-container">
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
            <div class="message-bubble" :class="{ 'is-html': msg.htmlContent, 'is-streaming': msg.isStreaming }">
              <!-- 流式输出中但还没有任何内容时，显示动态加载点 -->
              <template v-if="msg.isStreaming && !msg.content && !msg.thinking">
                <div class="thinking-dots">
                  <span class="dot">●</span>
                  <span class="dot">●</span>
                  <span class="dot">●</span>
                </div>
              </template>
              <template v-else-if="msg.htmlContent">
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

    <!-- 跳到底部按钮 -->
    <transition name="scroll-btn-fade">
      <div
        v-if="showScrollButton"
        class="scroll-to-bottom-btn"
        @click="jumpToBottom"
      >
        <el-icon :size="16"><ArrowDown /></el-icon>
      </div>
    </transition>
    
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { MagicStick, ArrowDown, ArrowRight, Monitor } from '@element-plus/icons-vue'
import { useAIStore } from '../../stores/ai'
import { useI18n } from '../../composables/useI18n'

const aiStore = useAIStore()
const { t } = useI18n()

const chatViewRef = ref(null)
const showError = ref(false)
const showScrollButton = ref(false)
const autoScroll = ref(true)             // 当前是否处于自动滚动模式
const SCROLL_THRESHOLD = 200             // 距底部超过此值显示跳转按钮

const messages = computed(() => aiStore.messages)
const greeting = computed(() => aiStore.getGreeting())
const userAvatar = ref('')
const aiAvatar = ref('')

// 当前是否有 AI 消息正在流式输出
const isAIStreaming = computed(() => {
  const msgs = aiStore.messages
  if (msgs.length === 0) return false
  const last = msgs[msgs.length - 1]
  return last.role === 'ai' && last.isStreaming
})

// 判断是否已在底部（5px 容差）
const isAtBottom = () => {
  const el = chatViewRef.value
  if (!el) return true
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 5
}

// 计算距底部的距离
const distanceFromBottom = () => {
  const el = chatViewRef.value
  if (!el) return 0
  return el.scrollHeight - (el.scrollTop + el.clientHeight)
}

// 滚动到底部
const scrollToBottom = (smooth = false) => {
  nextTick(() => {
    const el = chatViewRef.value
    if (!el) return
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      el.scrollTop = el.scrollHeight
    }
  })
}

// 手动跳到底部 → 重新启用自动滚动
const jumpToBottom = () => {
  autoScroll.value = true
  showScrollButton.value = false
  scrollToBottom(true)
}

// 监听容器滚动事件
const onScroll = () => {
  if (isAtBottom()) {
    // 用户滚到底部 → 恢复自动滚动
    showScrollButton.value = false
    if (isAIStreaming.value) {
      autoScroll.value = true
    }
  } else {
    // 用户离开了底部 → 停止自动滚动
    autoScroll.value = false
    // 距离超过阈值时显示跳转按钮
    showScrollButton.value = distanceFromBottom() > SCROLL_THRESHOLD
  }
}

// 消息变化时：仅当 autoScroll 为 true 才自动跟底
watch(messages, () => {
  if (autoScroll.value) {
    scrollToBottom()
  }
  // 如果处于非自动滚动模式，检查是否需要显示按钮
  if (!autoScroll.value && distanceFromBottom() > SCROLL_THRESHOLD) {
    showScrollButton.value = true
  }
}, { deep: true })

// AI 开始流式输出时：如果用户在底部则启用自动滚动
watch(isAIStreaming, (streaming) => {
  if (streaming && isAtBottom()) {
    autoScroll.value = true
    showScrollButton.value = false
  }
})

onMounted(() => {
  scrollToBottom()
  aiStore.fetchCurrentModel()
})

onUnmounted(() => {
  autoScroll.value = false
  showScrollButton.value = false
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
    max-width: 900px;
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

        .message-content {
          max-width: min(1100px, 100%);
        }
        
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

          // 思考中的动态三点加载动画
          &.is-streaming {
            .thinking-dots {
              display: flex;
              align-items: center;
              gap: 4px;
              padding: 4px 0;

              .dot {
                font-size: 8px;
                color: var(--text-secondary);
                animation: dotPulse 1.4s ease-in-out infinite;

                &:nth-child(1) { animation-delay: 0s; }
                &:nth-child(2) { animation-delay: 0.2s; }
                &:nth-child(3) { animation-delay: 0.4s; }
              }
            }
          }
          
          // Markdown 完整样式
          :deep(.markdown-content) {
            // ---- 标题 ----
            h1, h2, h3, h4, h5, h6 {
              margin: 16px 0 8px;
              font-weight: 600;
              line-height: 1.3;
              color: var(--text-primary);
              &:first-child { margin-top: 0; }
            }
            h1 { font-size: 1.6em; border-bottom: 2px solid var(--border-color); padding-bottom: 6px; }
            h2 { font-size: 1.4em; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; }
            h3 { font-size: 1.2em; }
            h4 { font-size: 1.1em; }
            h5 { font-size: 1em; }
            h6 { font-size: 0.95em; color: var(--text-secondary); }

            // ---- 段落 ----
            p {
              margin: 0 0 10px;
              line-height: 1.7;
              &:last-child { margin-bottom: 0; }
            }

            // ---- 行内格式 ----
            strong { font-weight: 700; }
            em { font-style: italic; }
            del { text-decoration: line-through; opacity: 0.6; }
            mark {
              background: rgba(230, 162, 60, 0.3);
              padding: 1px 3px;
              border-radius: 2px;
            }

            // ---- 行内代码 ----
            code {
              background: rgba(128, 128, 128, 0.2);
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Consolas', 'Fira Code', 'Source Code Pro', monospace;
              font-size: 0.88em;
              color: #e06c75;
              word-break: break-word;
            }

            // ---- 代码块 ----
            pre {
              background: rgba(128, 128, 128, 0.12);
              padding: 14px 16px;
              border-radius: 8px;
              overflow-x: auto;
              margin: 10px 0;
              border: 1px solid var(--border-color);
              position: relative;

              code {
                background: none;
                padding: 0;
                border-radius: 0;
                font-size: 0.85em;
                color: var(--text-primary);
                line-height: 1.6;
              }
            }

            // ---- 列表 ----
            ul, ol {
              padding-left: 24px;
              margin: 8px 0;
              li {
                margin-bottom: 4px;
                line-height: 1.6;
                &::marker { color: var(--text-secondary); }
              }
            }
            ul { list-style-type: disc; }
            ul ul { list-style-type: circle; }
            ul ul ul { list-style-type: square; }
            ol { list-style-type: decimal; }

            // ---- 任务列表 (GFM) ----
            ul:has(> li > input[type="checkbox"]) {
              list-style: none;
              padding-left: 4px;
              li { 
                display: flex;
                align-items: flex-start;
                gap: 6px;
                input[type="checkbox"] {
                  margin-top: 4px;
                  accent-color: var(--accent-color);
                  cursor: default;
                }
              }
            }

            // ---- 链接 ----
            a {
              color: var(--accent-color);
              text-decoration: none;
              border-bottom: 1px solid transparent;
              transition: border-color 0.2s;
              &:hover {
                border-bottom-color: var(--accent-color);
              }
            }

            // ---- 引用块 ----
            blockquote {
              border-left: 3px solid var(--accent-color);
              margin: 10px 0;
              padding: 6px 14px;
              color: var(--text-secondary);
              background: rgba(128, 128, 128, 0.06);
              border-radius: 0 6px 6px 0;
              p { margin-bottom: 6px; }
              p:last-child { margin-bottom: 0; }
            }

            // ---- 表格 ----
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 10px 0;
              font-size: 0.92em;
              overflow-x: auto;
              display: block;

              thead {
                background: rgba(128, 128, 128, 0.15);
                th {
                  font-weight: 600;
                  text-align: left;
                }
              }
              th, td {
                border: 1px solid var(--border-color);
                padding: 8px 12px;
                text-align: left;
              }
              tbody tr:nth-child(even) {
                background: rgba(128, 128, 128, 0.04);
              }
              tbody tr:hover {
                background: rgba(128, 128, 128, 0.08);
              }
            }

            // ---- 图片 ----
            img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              margin: 8px 0;
              display: block;
            }

            // ---- 分隔线 ----
            hr {
              border: none;
              border-top: 1px solid var(--border-color);
              margin: 16px 0;
            }

            // ---- 脚注 / 上标下标 ----
            sup, sub {
              font-size: 0.78em;
            }

            // ---- 定义列表 ----
            dl {
              margin: 8px 0;
              dt { font-weight: 600; margin-top: 8px; }
              dd { margin-left: 20px; color: var(--text-secondary); }
            }

            // ---- 缩写 ----
            abbr[title] {
              border-bottom: 1px dotted var(--text-secondary);
              cursor: help;
              text-decoration: none;
            }

            // ---- 键盘标签 ----
            kbd {
              background: rgba(128, 128, 128, 0.15);
              border: 1px solid var(--border-color);
              border-radius: 3px;
              padding: 1px 5px;
              font-family: monospace;
              font-size: 0.85em;
              box-shadow: 0 1px 0 var(--border-color);
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

  // 跳到底部按钮
  .scroll-to-bottom-btn {
    position: sticky;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent-color);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 50;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    transition: transform 0.2s, box-shadow 0.2s;
    margin: 0 auto;

    &:hover {
      transform: translateX(-50%) scale(1.1);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    }

    &:active {
      transform: translateX(-50%) scale(0.95);
    }
  }
}

.message-enter-active {
  transition: all 0.3s ease;
}

.message-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

@keyframes dotPulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1.2);
  }
}

// 跳转按钮过渡动画
.scroll-btn-fade-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.scroll-btn-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.scroll-btn-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.scroll-btn-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>

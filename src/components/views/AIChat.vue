<template>
  <div :class="['ai-chat-view', { 'has-messages': messages.length > 0 }]" ref="chatViewRef" @scroll="onScroll">
    <!-- 常驻头栏 -->
    <div class="ai-header-bar">
      <div class="ai-header-left">
        <el-dropdown trigger="click" @command="handleConvCmd">
          <span class="ai-header-title" style="cursor:pointer">
            {{ activeConvName }} <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu class="conv-dropdown">
              <div class="conv-list">
                <div v-for="conv in aiStore.conversations" :key="conv.id" class="conv-item" :class="{ active: conv.id === aiStore.activeConversationId }" @click="switchConv(conv.id)">
                  <span class="conv-name">{{ conv.name || '新对话' }}</span>
                  <span class="conv-actions" @click.stop>
                    <el-button :icon="EditPen" size="small" text @click="renameConv(conv)" />
                    <el-button v-if="aiStore.conversations.length > 1" :icon="Delete" size="small" text @click="deleteConv(conv.id)" />
                  </span>
                </div>
              </div>
              <el-dropdown-item command="new">
                <el-icon><Plus /></el-icon> 新建对话
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="ai-header-controls">
        <el-switch v-model="planningMode" size="small" active-text="规划" @change="onPlanningToggle" />
        <el-radio-group :model-value="aiMode" size="small" @change="onModeChange">
          <el-radio-button value="local">本地</el-radio-button>
          <el-radio-button value="cloud">云端</el-radio-button>
        </el-radio-group>
        <el-select
          v-if="aiMode === 'cloud' && hasCloudConfig"
          :model-value="cloudModelName"
          size="small"
          style="width:190px"
          @change="onCloudModelChange"
          placeholder="选择模型"
        >
          <el-option v-for="m in cloudModelList" :key="m.id" :label="m.name" :value="m.id" />
        </el-select>
        <el-tag v-else-if="aiMode === 'cloud'" size="small" type="warning" effect="plain" @click="goToSettings" style="cursor:pointer">
          请先配置API
        </el-tag>
        <el-tag v-else size="small" type="info" effect="plain">
          {{ localModelLabel }}
        </el-tag>
        <el-button :icon="Setting" circle size="small" @click="goToSettings" title="设置" />
      </div>
    </div>

    <!-- 欢迎/问候语 -->
    <div v-if="messages.length === 0" class="welcome-section">
      <el-icon class="ai-icon" :size="60"><MagicStick /></el-icon>
      <h2>Electronic</h2>
      <p class="intro">{{ t('aiChat.personalAssistant') }}</p>
      <p class="greeting">{{ greeting }}</p>
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
            <!-- 规划问题气泡 -->
            <div v-if="msg.type === 'question'" class="question-block">
              <div class="question-text">{{ msg.question }}</div>
              <div class="question-options">
                <el-button v-for="opt in msg.options" :key="opt"
                  size="small" :disabled="msg.answered"
                  @click="handlePickOption(msg, opt)">{{ opt }}</el-button>
                <el-button size="small" type="success"
                  :disabled="msg.answered"
                  @click="handleDirectExecute(msg)">直接执行</el-button>
              </div>
              <el-input v-if="customForQuestion === msg.id" v-model="customAnswer"
                placeholder="输入自定义内容" size="small"
                style="margin-top:6px;max-width:300px"
                @keydown.enter="handlePickOption(msg, customAnswer)" />
            </div>

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
                <span>{{ getThinkingLabel(msg) }}</span>
              </div>
              <div v-if="msg.showThinking" class="thinking-content">
                <pre>{{ msg.thinking }}</pre>
              </div>
            </div>
            
            <!-- PPT 课件卡片（嵌入当前消息） -->
            <div v-if="msg.pptxCard" class="pptx-card" @click="openPPTX(msg.pptxCard.filePath)">
              <div class="pptx-card-icon">
                <el-icon :size="48"><Document /></el-icon>
              </div>
              <div class="pptx-card-info">
                <div class="pptx-card-name">{{ msg.pptxCard.fileName || '课件.pptx' }}</div>
                <div class="pptx-card-meta" v-if="msg.pptxCard.slideCount">{{ msg.pptxCard.slideCount }} 页</div>
                <div class="pptx-card-desc">{{ msg.pptxCard.message }}</div>
                <div class="pptx-card-click">点击打开文件</div>
              </div>
            </div>

            <!-- 消息内容 - 支持Markdown -->
            <div v-if="msg.content || msg.htmlContent" class="message-bubble" :class="{ 'is-html': msg.htmlContent, 'is-streaming': msg.isStreaming }">
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted, onActivated } from 'vue'
import { MagicStick, ArrowDown, ArrowRight, Setting, Document, Plus, EditPen, Delete } from '@element-plus/icons-vue'
import { useAIStore } from '../../stores/ai'
import { useI18n } from '../../composables/useI18n'
import { getUserAvatar } from '../../composables/useAvatar'

const aiStore = useAIStore()
const { t } = useI18n()

const emit = defineEmits(['navigate'])

const aiMode = ref(aiStore.aiMode)
const cloudModelName = ref(aiStore.cloudModel)
const localModelLabel = ref(aiStore.currentModel || '本地模型')
const planningMode = ref(aiStore.planningMode)
const customForQuestion = ref('')
const customAnswer = ref('')

// 同步 store 变化到本地 ref
watch(() => aiStore.aiMode, v => { aiMode.value = v })
watch(() => aiStore.cloudModel, v => { cloudModelName.value = v })
watch(() => aiStore.currentModel, v => { localModelLabel.value = v || '本地模型' })
watch(() => aiStore.planningMode, v => { planningMode.value = v })

const CLOUD_PROVIDERS = [
  { id: 'deepseek', models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', thinking: 'none', contextLimit: 1000000 }, { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', thinking: 'always', contextLimit: 1000000 }] },
  { id: 'openai', models: [{ id: 'gpt-4o', name: 'GPT-4o', thinking: 'none' }, { id: 'gpt-4o-mini', name: 'GPT-4o Mini', thinking: 'none' }, { id: 'o3-mini', name: 'o3-mini', thinking: 'optional' }, { id: 'o1', name: 'o1', thinking: 'always' }] },
  { id: 'qwen', models: [{ id: 'qwen-plus', name: 'Qwen Plus', thinking: 'none' }, { id: 'qwen-max', name: 'Qwen Max', thinking: 'optional' }, { id: 'qwen-turbo', name: 'Qwen Turbo', thinking: 'none' }, { id: 'qwen-long', name: 'Qwen Long', thinking: 'none' }] },
  { id: 'zhipu', models: [{ id: 'glm-4-flash', name: 'GLM-4 Flash', thinking: 'none' }, { id: 'glm-4', name: 'GLM-4', thinking: 'optional' }, { id: 'glm-4-plus', name: 'GLM-4 Plus', thinking: 'optional' }] },
  { id: 'moonshot', models: [{ id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', thinking: 'none' }, { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', thinking: 'none' }, { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', thinking: 'none' }] },
  { id: 'custom', models: [] }
]

function readCloudConfig() {
  try {
    const raw = localStorage.getItem('cloudApiSettings')
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

const hasCloudConfig = computed(() => {
  void aiMode.value
  void cloudModelName.value
  const cfg = readCloudConfig()
  return !!(cfg.base && cfg.model)
})

const cloudModelList = computed(() => {
  const cfg = readCloudConfig()
  const providerId = cfg.provider || aiStore.cloudProvider
  const p = CLOUD_PROVIDERS.find(p => p.id === providerId)
  return p ? p.models : [{ id: 'gpt-4o', name: 'GPT-4o' }, { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }]
})

const chatViewRef = ref(null)
const showError = ref(false)
const showScrollButton = ref(false)
const autoScroll = ref(true)             // 当前是否处于自动滚动模式
const SCROLL_THRESHOLD = 200             // 距底部超过此值显示跳转按钮

const messages = computed(() => aiStore.messages)
const greeting = computed(() => aiStore.getGreeting())

function onModeChange(mode) {
  aiMode.value = mode
  aiStore.setAiMode(mode)
}

function onCloudModelChange(model) {
  cloudModelName.value = model
  aiStore.setCloudModel(model)
  const cfg = readCloudConfig()
  cfg.model = model
  try { localStorage.setItem('cloudApiSettings', JSON.stringify(cfg)) } catch {}
}

function goToSettings() {
  localStorage.setItem('settingsActiveNav', 'ai')
  emit('navigate', 'settings')
}

async function openPPTX(filePath) {
  if (!filePath) return
  if (window.electronAPI?.openFilePath) {
    await window.electronAPI.openFilePath(filePath)
  }
}

function newConversation() {
  aiStore.newConversation()
  autoScroll.value = true
  showScrollButton.value = false
}

function onPlanningToggle(val) {
  aiStore.setPlanningMode(val)
  if (!val && window.electronAPI?.agentCancelPlanning) {
    window.electronAPI.agentCancelPlanning()
  }
}

function handlePickOption(msg, option) {
  if (!option || option === '其他' || option === '其它') {
    customForQuestion.value = msg.id
    return
  }
  aiStore.addUserChoice(msg.id, option)
  customForQuestion.value = ''
  customAnswer.value = ''
  handleAgentResend(option)
}

function handleDirectExecute(msg) {
  aiStore.addUserChoice(msg.id, '直接执行')
  handleAgentResend('请根据已确认的信息直接执行任务')
}

function handleAgentResend(message) {
  const inputMsg = message
  const currentUsername = localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')).username : ''
  const currentMode = localStorage.getItem('aiMode') || aiStore.aiMode || 'local'
  // Trigger send via a custom event or direct call
  window.dispatchEvent(new CustomEvent('planning-send', { detail: { message: inputMsg, currentUsername, currentMode } }))
}

function getThinkingLabel(msg) {
  if (!msg.thinking && msg.isStreaming) return '思考中...'
  if (!msg.thinking) return ''
  if (msg.isStreaming) {
    if (msg.thinking.includes('正在生成')) return '正在制作课件...'
    if (msg.thinking.includes('正在设计')) return '正在设计课件...'
    if (msg.thinking.includes('正在保存')) return '正在保存课件...'
    if (msg.thinking.includes('generate_pptx')) return '正在制作课件...'
    if (msg.thinking.includes('send_message')) return '正在发送...'
    if (msg.thinking.includes('send_broadcast')) return '正在广播...'
  }
  const lines = msg.thinking.trim().split('\n')
  const last = lines[lines.length - 1].trim()
  if (msg.isStreaming && last.length > 3 && last.length < 40) return last
  return msg.isStreaming ? '思考中...' : '思考过程'
}

function switchConv(id) {
  aiStore.switchConversation(id)
  autoScroll.value = true
}

function deleteConv(id) {
  aiStore.deleteConversation(id)
}

function renameConv(conv) {
  ElMessageBox.prompt('请输入新名称', '重命名对话', {
    inputValue: conv.name,
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  }).then(({ value }) => {
    if (value && value.trim()) {
      aiStore.renameConversation(conv.id, value.trim())
    }
  }).catch(() => {})
}

function handleConvCmd(cmd) {
  if (cmd === 'new') newConversation()
}

const activeConvName = computed(() => {
  const conv = aiStore.conversations.find(c => c.id === aiStore.activeConversationId)
  return conv ? (conv.name || '新对话') : 'AI 助手'
})

function getCurrentUsername() {
  try {
    const stored = localStorage.getItem('userInfo')
    if (stored) return JSON.parse(stored).username || ''
  } catch { /* ignore */ }
  return ''
}

const userAvatar = computed(() => getUserAvatar(getCurrentUsername()))
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
  if (aiMode.value === 'local') {
    aiStore.fetchCurrentModel()
  }
})

onActivated(() => {
  autoScroll.value = true
  scrollToBottom()
})

onUnmounted(() => {
  autoScroll.value = false
  showScrollButton.value = false
})
</script>

<style lang="scss" scoped>
.ai-chat-view {
  height: calc(100vh - 60px);
  padding: 0 30px 100px;
  overflow-y: hidden;
  position: relative;

  &.has-messages {
    overflow-y: auto;
  }

  .ai-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 8px;
    position: sticky;
    top: 0;
    background: var(--bg-primary);
    z-index: 10;

    .ai-header-left {
      display: flex;
      align-items: center;

      .el-dropdown {
        .ai-header-title:hover { color: var(--accent-color); }
      }
    }

    .ai-header-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .ai-header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
  
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
    max-width: 900px;
    margin: 0 auto;
    
    .message-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 20px;
      
      // 防止头像被内容挤压变形
      :deep(.el-avatar) {
        flex-shrink: 0;
        margin-top: 2px;
      }
      
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
          min-width: 0;
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
            padding: 8px 0;
            margin-top: 2px;
            
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
  
  .pptx-card {
    display: flex;
    align-items: center;
    gap: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    margin: 8px 0;
    cursor: pointer;
    transition: all 0.2s ease;
    max-width: 420px;

    &:hover {
      border-color: var(--accent-color);
      background: rgba(74, 158, 255, 0.06);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .pptx-card-icon {
      flex-shrink: 0;
      color: #d24726;
      opacity: 0.9;
    }

    .pptx-card-info {
      flex: 1;
      min-width: 0;

      .pptx-card-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 2px;
      }

      .pptx-card-meta {
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }

      .pptx-card-desc {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }

      .pptx-card-click {
        font-size: 12px;
        color: var(--accent-color);
        font-weight: 500;
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
    position: fixed;
    bottom: 100px;
    right: 24px;
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

    &:hover {
      transform: scale(1.1);
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

// 规划问题气泡
.question-block {
  background: rgba(74, 158, 255, 0.06);
  border: 1px solid rgba(74, 158, 255, 0.2);
  border-radius: 12px;
  padding: 14px;
  margin: 8px 0;

  .question-text {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 10px;
  }

  .question-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>

<style>
.conv-dropdown {
  max-height: 320px;
  overflow: hidden;
  min-width: 260px;
}

.conv-list {
  max-height: 240px;
  overflow-y: auto;
}

.conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.conv-item:hover {
  background: var(--hover-bg);
}

.conv-item.active {
  background: rgba(74, 158, 255, 0.12);
}

.conv-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.conv-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.conv-item:hover .conv-actions {
  opacity: 1;
}
</style>

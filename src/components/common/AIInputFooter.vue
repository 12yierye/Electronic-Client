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

const aiStore = useAIStore()
const userStore = useUserStore()
const { t } = useI18n()
const inputMessage = ref('')
const isSending = ref(false)

// 解析发送意图（定时或立即）
const parseScheduledIntent = (message) => {
  // 统一将全角冒号转换为半角
  const normalizedMessage = message.replace(/：/g, ':')

  console.log('[parseScheduledIntent] 原始消息:', message)
  console.log('[parseScheduledIntent] 规范化后:', normalizedMessage)

  // 时间模式 - 支持 00:00 或 在00:00 格式，以及"1分钟后"等
  const timePatterns = [
    /在\s*(\d{1,2}:\d{2})/,
    /(\d{1,2}:\d{2})/,
    /(\d+)\s*分钟\s*后/
  ]

  // 文件扩展名列表
  const fileExtensions = ['docx', 'xlsx', 'pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'zip', 'rar', '7z', 'pptx', 'doc', 'xls', 'csv', 'npmrc']

  // 匹配文件名模式
  const fileNamePattern = new RegExp(
    `(?:名为|发送(?:给)?|发给|发送给)\\s*([^\\s,，]+(?:\\.(?:${fileExtensions.join('|')})))`,
    'i'
  )

  let time = null
  let minutesLater = null
  let targetUser = null
  let filename = null
  let content = null
  let isFile = false

  // 提取时间
  for (const pattern of timePatterns) {
    const match = normalizedMessage.match(pattern)
    if (match) {
      if (match[1] && pattern.toString().includes('分钟')) {
        minutesLater = parseInt(match[1])
        time = minutesLater
      } else {
        time = match[1] || match[0]
      }
      console.log('[parseScheduledIntent] 提取到时间:', time)
      break
    }
  }

  // 提取文件名
  const fileMatch = normalizedMessage.match(fileNamePattern)
  if (fileMatch) {
    filename = fileMatch[1]
    isFile = true
    console.log('[parseScheduledIntent] 提取到文件名:', filename)
  }

  // 提取用户名 - 优先提取"向XXX发送/说"格式
  const userMatch1 = normalizedMessage.match(/向\s*(\S+?)\s+(?:发送|发给|发送给|说|发)/)
  if (userMatch1) {
    targetUser = userMatch1[1]
    console.log('[parseScheduledIntent] 提取到用户名:', targetUser)
  } else {
    // 尝试其他模式
    const userMatch2 = normalizedMessage.match(/发给\s*(\S+?)\s+(?:发送|发给|发送给|说|发)/)
    if (userMatch2) {
      targetUser = userMatch2[1]
      console.log('[parseScheduledIntent] 提取到用户名:', targetUser)
    }
  }

  // 提取文字内容（如果是文字消息）
  if (!isFile) {
    const textContentMatch = normalizedMessage.match(/说\s*(.+)$/)
    if (textContentMatch) {
      content = textContentMatch[1].trim()
      console.log('[parseScheduledIntent] 提取到文字内容:', content)
    }
  }

  // 判断是定时发送还是立即发送
  const hasTime = time !== null || minutesLater !== null

  // 返回结果
  if (isFile && hasTime && targetUser && filename) {
    if (minutesLater) {
      console.log('[parseScheduledIntent] 识别为立即发送文件:', { type: 'file', immediate: true, minutesLater, targetUser, filename })
      return { type: 'file', immediate: true, minutesLater, targetUser, filename }
    }
    console.log('[parseScheduledIntent] 识别为定时发送文件:', { type: 'file', time, targetUser, filename })
    return { type: 'file', time, targetUser, filename }
  }

  if (hasTime && targetUser && content) {
    if (minutesLater) {
      console.log('[parseScheduledIntent] 识别为立即发送文字:', { type: 'text', immediate: true, minutesLater, targetUser, content })
      return { type: 'text', immediate: true, minutesLater, targetUser, content }
    }
    console.log('[parseScheduledIntent] 识别为定时发送文字:', { type: 'text', time, targetUser, content })
    return { type: 'text', time, targetUser, content }
  }

  // 支持立即发送（无时间关键词）
  if (!hasTime && isFile && targetUser && filename) {
    console.log('[parseScheduledIntent] 识别为立即发送文件（无时间）:', { type: 'file', immediate: true, targetUser, filename })
    return { type: 'file', immediate: true, targetUser, filename }
  }

  if (!hasTime && targetUser && content) {
    console.log('[parseScheduledIntent] 识别为立即发送文字（无时间）:', { type: 'text', immediate: true, targetUser, content })
    return { type: 'text', immediate: true, targetUser, content }
  }

  console.log('[parseScheduledIntent] 无法识别发送意图')
  return null
}

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

  const currentUsername = userStore.userInfo?.username

  // 直接发送消息给 AI，让 AI 判断意图
  // AI 会返回 FUNCTION:schedule_file_send 或 FUNCTION:schedule_message_send
  // 前端检测到函数调用后执行对应操作

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
      // 检测到意图识别结果
      if (data.likelyIntent === 'scheduled') {
        console.log('[Renderer] AI 检测到定时发送意图，等待函数调用...')
      }

      // 检测到函数调用
      if (data.functionCall) {
        console.log('[Renderer] 检测到函数调用:', data.functionCall)
        
        // 从回复中提取参数
        const fullContent = data.content || ''
        
        // 解析参数
        const params = parseScheduledIntent(message)
        
        if (params) {
          let scheduleTime = null
          let timeStr = ''

          // 如果是定时发送（有具体时间）
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
            // 如果是"X分钟后"
            const now = new Date()
            now.setMinutes(now.getMinutes() + params.minutesLater)
            scheduleTime = now.toISOString()
            timeStr = `${params.minutesLater}分钟后`
          }
          // 如果是立即发送（无时间），scheduleTime 为 null

          // 执行对应的发送任务
          executeFunctionCall(data.functionCall, params, scheduleTime, timeStr, currentUsername)
        } else {
          // 参数解析失败，提示用户格式不对
          aiStore.endStreamingMessage()
          aiStore.addUserMessage(message)
          aiStore.addAIMessage(`我理解了，您想要发送消息。但是您的表达格式不太对，请按照以下格式告诉我：\n\n📁 **发送文件**：\n"向 张三 发送 报告.docx"\n"发给李四 文档.xlsx"\n\n⏰ **定时发送文件**：\n"在 15:30 向 张三 发送 报告.docx"\n"1分钟后向李四发送文档.xlsx"\n\n💬 **发送文字**：\n"向 张三 说 你好"\n\n请重新告诉我吧！`)
        }
        return
      }

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

// 执行函数调用
const executeFunctionCall = async (functionName, params, scheduleTime, timeStr, currentUsername) => {
  console.log('[executeFunctionCall] 执行函数:', functionName, params)

  if (functionName === 'schedule_file_send') {
    // 定时发送文件
    console.log('[Renderer] 执行定时发送文件:', params, '执行时间:', scheduleTime)

    const filesResult = await window.electronAPI.getUserFiles(currentUsername)
    if (!filesResult.success || !filesResult.files) {
      aiStore.addUserMessage(message)
      aiStore.addAIMessage(`抱歉，无法获取您的文件列表。请先上传文件 "${params.filename}"。`)
      return
    }

    const fileExists = filesResult.files.some(f => f.filename === params.filename)
    if (!fileExists) {
      aiStore.addUserMessage(message)
      aiStore.addAIMessage(`抱歉，我没有在您的文件列表中找到名为 "${params.filename}" 的文件。\n\n可能的原因：\n1. 文件名输入错误（请检查文件名是否正确，包括扩展名）\n2. 文件是7天前上传的（系统会自动删除7天前的文件）\n\n请重新上传文件后告诉我，或者检查文件名是否正确。`)
      return
    }

    const result = await window.electronAPI.scheduleFileSend(scheduleTime, params.targetUser, params.filename, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(`好的！我已安排在 ${timeStr} 向 "${params.targetUser}" 发送文件 "${params.filename}"。`)
    } else {
      aiStore.addAIMessage(`抱歉，设置定时发送失败: ${result.message}`)
    }

  } else if (functionName === 'schedule_message_send') {
    // 定时发送文字消息
    console.log('[Renderer] 执行定时发送文字:', params, '执行时间:', scheduleTime)

    const result = await window.electronAPI.scheduleMessageSend(scheduleTime, params.targetUser, params.content, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(`好的！我已安排在 ${timeStr} 向 "${params.targetUser}" 发送消息："${params.content}"。`)
    } else {
      aiStore.addAIMessage(`抱歉，设置定时发送失败: ${result.message}`)
    }

  } else if (functionName === 'send_file_now') {
    // 立即发送文件
    console.log('[Renderer] 执行立即发送文件:', params)

    const filesResult = await window.electronAPI.getUserFiles(currentUsername)
    if (!filesResult.success || !filesResult.files) {
      aiStore.addAIMessage(`抱歉，无法获取您的文件列表。请先上传文件 "${params.filename}"。`)
      return
    }

    const fileExists = filesResult.files.some(f => f.filename === params.filename)
    if (!fileExists) {
      aiStore.addAIMessage(`抱歉，我没有在您的文件列表中找到名为 "${params.filename}" 的文件。\n\n可能的原因：\n1. 文件名输入错误（请检查文件名是否正确，包括扩展名）\n2. 文件是7天前上传的（系统会自动删除7天前的文件）\n\n请重新上传文件后告诉我，或者检查文件名是否正确。`)
      return
    }

    const result = await window.electronAPI.sendFileNow(params.targetUser, params.filename, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(`好的！文件 "${params.filename}" 已立即发送给 "${params.targetUser}"。`)
    } else {
      aiStore.addAIMessage(`抱歉，发送文件失败: ${result.message}`)
    }

  } else if (functionName === 'send_message_now') {
    // 立即发送文字消息
    console.log('[Renderer] 执行立即发送文字:', params)

    const result = await window.electronAPI.sendMessageNow(params.targetUser, params.content, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(`好的！消息已立即发送给 "${params.targetUser}"。`)
    } else {
      aiStore.addAIMessage(`抱歉，发送消息失败: ${result.message}`)
    }

  } else {
    // 未知函数名
    aiStore.addAIMessage(`抱歉，我无法执行该操作：${functionName}`)
  }
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

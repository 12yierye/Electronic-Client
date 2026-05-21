import { ipcMain } from 'electron'
import axios from 'axios'
import { getLMStudioAPI, setLMStudioAPI } from '../config.js'

export function registerAiIpc() {
  // 动态设置 AI API 地址
  ipcMain.handle('set-ai-api-url', (event, url) => {
    setLMStudioAPI(url)
    return { success: true }
  })

  const apiUrl = () => getLMStudioAPI()
  function getSystemPrompt(likelyScheduledIntent, likelyImmediateIntent) {
    if (!likelyScheduledIntent && !likelyImmediateIntent) {
      return '你是一个友好的AI助手，请用中文回答用户的问题。'
    }

    return `你是一个友好的AI助手。
当用户表达以下意图时，请按指定格式返回函数名，不要返回其他内容：

1. 定时发送文件意图：用户想在某个具体时间（如"15:30"、"1分钟后"）向某人发送文件
   - 关键词：时间（如"15:30"、"1分钟后"）、发送文件、文件名、接收人
   - 返回格式：FUNCTION:schedule_file_send

2. 立即发送文件意图：用户想现在立即向某人发送文件（没有指定具体时间）
   - 关键词：发送文件、文件名、接收人（无时间或"现在"、"立即"）
   - 返回格式：FUNCTION:send_file_now

3. 定时发送文字消息意图：用户想在某个时间向某人发送文字消息
   - 关键词：时间、发送消息/文字、接收人
   - 返回格式：FUNCTION:schedule_message_send

4. 立即发送文字消息意图：用户想现在立即向某人发送文字消息
   - 关键词：发送消息/文字、接收人（无时间或"现在"、"立即"）
   - 返回格式：FUNCTION:send_message_now

5. 普通聊天：上述情况之外
   - 正常回复用户问题，不要返回任何 FUNCTION: 开头的标记

请根据用户消息判断意图并返回相应格式。如果用户只是询问如何操作，请正常回答。`
  }

  async function fetchCurrentModel() {
    const response = await axios.get(`${apiUrl()}/models`, { timeout: 5000 })
    if (response.data?.data?.length > 0) {
      return response.data.data[0].id
    }
    return null
  }

  ipcMain.handle('ai-chat', async (event, userMessage) => {
    console.log('[AI Chat] msg:', userMessage.substring(0, 80))

    let currentModel = null
    try {
      currentModel = await fetchCurrentModel()
      if (!currentModel) {
        return { success: false, message: '请先在 LM Studio 中加载模型' }
      }
      console.log('[AI Chat] model:', currentModel)
    } catch (error) {
      console.log('[AI Chat] model fetch failed:', error.message)
      return { success: false, message: '无法连接到 LM Studio，请确保 LM Studio 正在运行' }
    }

    try {
      const requestBody = {
        model: currentModel,
        messages: [
          { role: 'system', content: '你是一个友好的AI助手，请用中文回答用户的问题。' },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 16384
      }
      if (!currentModel.toLowerCase().includes('qwen3') && !currentModel.toLowerCase().includes('qwen')) {
        requestBody.temperature = 0.7
      }
      if (currentModel.toLowerCase().includes('qwen3') || currentModel.toLowerCase().includes('qwen')) {
        requestBody.extra_body = { enable_thinking: true, thinking_budget: 4096 }
      }

      const response = await axios.post(`${apiUrl()}/chat/completions`, requestBody, { timeout: 120000 })
      const reply = response.data.choices[0].message.content.trim()
      console.log('[AI Chat] reply length:', reply.length)
      return { success: true, reply }
    } catch (error) {
      console.error('[AI Chat] error:', error.message)
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('get-current-model', async () => {
    try {
      const model = await fetchCurrentModel()
      if (model) {
        console.log('[GetModel]', model)
        return { success: true, model }
      }
      return { success: false, message: '未加载模型' }
    } catch (error) {
      console.error('[GetModel] err:', error.message)
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('ai-chat-stream', async (event, userMessage) => {
    console.log('[AI Stream] msg:', userMessage.substring(0, 80))

    let currentModel = null
    try {
      currentModel = await fetchCurrentModel()
      if (!currentModel) {
        return { success: false, message: '请先在 LM Studio 中加载模型' }
      }
      console.log('[AI Stream] model:', currentModel)
    } catch (error) {
      console.log('[AI Stream] model fetch failed:', error.message)
      return { success: false, message: '无法连接到 LM Studio，请确保 LM Studio 正在运行' }
    }

    const hasTimePattern = /(\d{1,2}:\d{2})/.test(userMessage.replace(/：/g, ':'))
    const hasSendPattern = /发送|发给|发送给|定时|说/.test(userMessage)
    const hasUserPattern = /向\s*\S+|发给\s*\S+|发送给\s*\S+/.test(userMessage)
    const likelyScheduledIntent = hasTimePattern && hasSendPattern && hasUserPattern

    const hasImmediateSendPattern = /^(?!.*\d{1,2}:\d{2}).*(?:发送|发给|发送给)\s+\S+/i.test(userMessage)
    const likelyImmediateIntent = hasImmediateSendPattern && hasUserPattern

    if (likelyScheduledIntent || likelyImmediateIntent) {
      event.sender.send('ai-chat-stream-chunk', {
        intentDetected: true,
        likelyIntent: likelyScheduledIntent ? 'scheduled' : 'normal'
      })
    }

    const requestBody = {
      model: currentModel,
      messages: [
        { role: 'system', content: getSystemPrompt(likelyScheduledIntent, likelyImmediateIntent) },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      max_tokens: 16384
    }

    if (!currentModel.toLowerCase().includes('qwen3') && !currentModel.toLowerCase().includes('qwen')) {
      requestBody.temperature = 0.7
    }

    if (currentModel.toLowerCase().includes('qwen3') || currentModel.toLowerCase().includes('qwen')) {
      requestBody.extra_body = {
        enable_thinking: true,
        thinking_budget: 4096
      }
    }

    try {
      const response = await axios.post(
        `${apiUrl()}/chat/completions`,
        requestBody,
        { responseType: 'stream', timeout: 120000 }
      )

      return new Promise((resolve) => {
        let fullReply = ''
        let fullReasoning = ''
        let streamBuffer = ''
        let receivedDone = false

        response.data.on('data', (chunk) => {
          streamBuffer += chunk.toString()
          const parts = streamBuffer.split('\n')
          streamBuffer = parts.pop() || ''

          for (const line of parts) {
            const trimmedLine = line.trim()
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

            const data = trimmedLine.slice(6)
            if (data === '[DONE]') {
              receivedDone = true
              continue
            }

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || ''

              if (reasoning) {
                fullReasoning += reasoning
                event.sender.send('ai-chat-stream-chunk', { reasoning })
              }
              if (content) {
                fullReply += content
                event.sender.send('ai-chat-stream-chunk', { content })
              }
            } catch (e) {
              console.warn('[AI Stream] JSON parse failed:', data.substring(0, 80))
            }
          }
        })

        response.data.on('end', () => {
          if (streamBuffer) {
            const parts = streamBuffer.split('\n')
            for (const line of parts) {
              const trimmedLine = line.trim()
              if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

              const data = trimmedLine.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ''
                const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || ''
                if (reasoning) {
                  fullReasoning += reasoning
                  event.sender.send('ai-chat-stream-chunk', { reasoning })
                }
                if (content) {
                  fullReply += content
                  event.sender.send('ai-chat-stream-chunk', { content })
                }
              } catch (e) {
                console.warn('[AI Stream] end buffer parse failed:', data.substring(0, 80))
              }
            }
          }

          console.log('[AI Stream] stream ended, reply length:', fullReply.length, 'reasoning length:', fullReasoning.length)

          if (fullReply || fullReasoning) {
            const functionMatch = fullReply.match(/FUNCTION:\s*(schedule_file_send|schedule_message_send|send_file_now|send_message_now)/)
            if (functionMatch) {
              const functionName = functionMatch[1]
              console.log('[AI Stream] function call:', functionName)
              event.sender.send('ai-chat-stream-chunk', {
                done: true,
                functionCall: functionName
              })
            } else {
              event.sender.send('ai-chat-stream-chunk', { done: true })
            }
          } else {
            event.sender.send('ai-chat-stream-chunk', { done: true })
          }
          resolve({ success: true, reply: fullReply, reasoning: fullReasoning })
        })

        response.data.on('error', (err) => {
          console.error('[AI Stream] stream error:', err.message)
          event.sender.send('ai-chat-stream-error', { message: err.message })
          resolve({ success: false, message: err.message })
        })
      })
    } catch (error) {
      console.error('[AI Stream] error:', error.message)
      event.sender.send('ai-chat-stream-error', { message: error.message })
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('generate-function', async (event, prompt) => {
    try {
      let currentModel = null
      try {
        currentModel = await fetchCurrentModel()
        if (!currentModel) {
          return { success: false, message: '请先在 LM Studio 中加载模型' }
        }
      } catch (e) {
        return { success: false, message: '无法连接到 LM Studio' }
      }

      console.log('[GenFunc] model:', currentModel, 'prompt:', prompt.substring(0, 80))
      const requestBody = {
        model: currentModel,
        messages: [
          { role: 'system', content: '你是一个代码生成助手。根据用户需求，生成一个 JavaScript 函数。只返回函数代码，不要其他解释，不要任何markdown代码块标记。函数要可以直接用 new Function() 执行。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      }
      const response = await axios.post(`${apiUrl()}/chat/completions`, requestBody, { timeout: 120000 })
      const code = response.data.choices[0].message.content.trim()
      console.log('[GenFunc] code length:', code.length)
      return { success: true, code }
    } catch (error) {
      console.error('[GenFunc] error:', error.message)
      return { success: false, message: error.message }
    }
  })
}

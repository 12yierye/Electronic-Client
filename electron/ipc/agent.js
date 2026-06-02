import crypto from 'crypto'
import { ipcMain } from 'electron'
import { runAgent, clearPlanningSession, planningAgent } from '../services/agentEngine.js'
import { route } from '../services/modelRouter.js'
import { generatePPTX, generatePPTXFromMeta } from '../services/pptxGenerator.js'
import { generateHandout } from '../services/handoutGenerator.js'
import fs from 'fs'
import { setCloudAPIBase, setCloudAPIKey, setCloudModel, setCloudProvider } from '../config.js'

let agentRunning = false
let currentAbortController = null
let currentSessionId = null

async function executePlannedTool(toolCall, toolParams, origMessage, progressCallback, chunkCallback) {
  if (toolCall === 'generate_pptx') {
    chunkCallback({ type: 'reasoning', content: '📐 正在设计课件结构...\n' })
    const result = await generatePPTX(toolParams, origMessage, progressCallback)
    if (result.success && result.path) {
      chunkCallback({ type: 'pptx_card', fileName: result.fileName, path: result.path, slideCount: result.slideCount, message: result.message })
    }
    return result.message || (result.success ? '课件已生成' : `生成失败: ${result.message}`)
  }
  if (toolCall === 'generate_lesson_package') {
    chunkCallback({ type: 'reasoning', content: '📦 正在生成教案包...\n' })
    const pptxResult = await generatePPTX(toolParams, origMessage, progressCallback)
    if (!pptxResult.success) return `PPTX生成失败: ${pptxResult.message}`
    if (pptxResult.path) {
      chunkCallback({ type: 'pptx_card', fileName: pptxResult.fileName, path: pptxResult.path, slideCount: pptxResult.slideCount, message: pptxResult.message })
    }
    let outline
    try {
      const metaPath = pptxResult.path?.replace('.pptx', '.meta.json')
      if (metaPath && fs.existsSync(metaPath)) {
        outline = JSON.parse(fs.readFileSync(metaPath, 'utf-8')).outline
      }
    } catch {}
    const handoutResult = await generateHandout(pptxResult, toolParams.topic, outline)
    chunkCallback({ type: 'reasoning', content: handoutResult.success ? '📄 讲义已生成' : `讲义生成失败: ${handoutResult.message}` })
    return `✅ 教案包已生成\n📊 课件: ${pptxResult.fileName}（${pptxResult.slideCount || 0}页）\n📄 讲义: ${handoutResult.fileName || '未生成'}`
  }
  return null
}

export function registerAgentIpc() {
  ipcMain.handle('agent:run', async (event, { message, aiMode, cloudConfig, history, pptCards, planningMode }) => {
    console.log('[Agent] run request — mode:', aiMode, 'cloud:', !!cloudConfig?.key, 'planning:', planningMode, 'history:', history?.length)

    if (agentRunning) {
      return { success: false, message: 'Agent 正在运行中，请等待当前任务完成' }
    }

    if (cloudConfig) {
      if (cloudConfig.base) setCloudAPIBase(cloudConfig.base)
      if (cloudConfig.key) setCloudAPIKey(cloudConfig.key)
      if (cloudConfig.model) setCloudModel(cloudConfig.model)
      if (cloudConfig.provider) setCloudProvider(cloudConfig.provider)
    }

    agentRunning = true
    currentAbortController = new AbortController()
    let chunkCount = 0

    const progressCallback = (progress) => {
      try { event.sender.send('agent:progress', progress) } catch (_) {}
    }
    const chunkCallback = (chunk) => {
      chunkCount++
      console.log('[Agent] chunk', chunkCount, 'type:', chunk.type, 'len:', chunk.content?.length)
      try { event.sender.send('agent:chunk', chunk) } catch (_) {}
    }

    try {
      const contextMessages = (history || []).map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content }))
      if (pptCards?.length) {
        contextMessages.push({ role: 'system', content: `Previously generated PPT files: ${JSON.stringify(pptCards)}` })
      }
      const context = [{ aiMode }, ...contextMessages]

      let reply
      if (planningMode) {
        const sessionId = crypto.randomUUID()
        currentSessionId = sessionId
        const routing = await route(message, aiMode)
        if (routing.backend === 'none') {
          agentRunning = false
          return { success: false, message: routing.error }
        }
        progressCallback({ type: 'routing', backend: routing.backend, reason: routing.reason })
        const planResult = await planningAgent(sessionId, message, context, routing, progressCallback, chunkCallback, currentAbortController.signal)

        if (planResult.action === 'ask') {
          reply = ''
        } else if (planResult.action === 'execute') {
          console.log('[Agent] planning execute, messages:', planResult.messages.length, 'toolCall:', planResult.toolCall)

          if (planResult.toolCall) {
            const directResult = await executePlannedTool(planResult.toolCall, planResult.toolParams || {}, message, progressCallback, chunkCallback)
            reply = directResult || '任务已执行完毕。'
          } else {
            const conversationHistory = planResult.messages.filter(m => m.role !== 'system')
            const execMessage = planResult.summary
              ? `请根据以下确认的需求执行任务：${planResult.summary}。原始请求：${message}`
              : message
            reply = await runAgent(
              execMessage, conversationHistory, progressCallback, chunkCallback, currentAbortController.signal, routing, true
            )
          }
        } else {
          reply = planResult.error || '规划失败'
        }
      } else {
        reply = await runAgent(
          message, context, progressCallback, chunkCallback, currentAbortController.signal
        )
      }

      agentRunning = false
      currentAbortController = null
      currentSessionId = null
      return { success: true, reply, cancelled: false }
    } catch (error) {
      agentRunning = false
      currentAbortController = null
      if (error.name === 'CanceledError' || error.name === 'AbortError') {
        return { success: true, reply: '', cancelled: true }
      }
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('agent:cancel', async () => {
    if (currentAbortController) {
      currentAbortController.abort()
    }
    return { success: true }
  })

  ipcMain.handle('agent:cancelPlanning', async () => {
    clearPlanningSession(currentSessionId)
    currentSessionId = null
    return { success: true }
  })

  ipcMain.handle('agent:status', async () => {
    return { running: agentRunning }
  })

  ipcMain.handle('agent:generateTitle', async (_event, { message }) => {
    try {
      const routing = await route(message, 'local')
      if (routing.backend === 'none') return { title: null }
      const headers = { 'Content-Type': 'application/json' }
      if (routing.apiKey) headers['Authorization'] = `Bearer ${routing.apiKey}`

      const res = await (await import('axios')).default.post(routing.apiUrl, {
        model: routing.model || 'local',
        messages: [
          { role: 'system', content: 'Summarize the following user request into a very short title (max 10 characters in Chinese). Output ONLY the title, no quotes, no explanation.' },
          { role: 'user', content: message }
        ],
        max_tokens: 20,
        temperature: 0.3
      }, { headers, timeout: 15000 })

      const raw = res.data?.choices?.[0]?.message?.content || ''
      const title = raw.replace(/["""''""]/g, '').replace(/\n/g, ' ').trim().slice(0, 20)
      return { title: title || null }
    } catch (e) {
      console.error('[Agent] generateTitle failed:', e.message)
      return { title: null }
    }
  })
}

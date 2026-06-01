import { ipcMain } from 'electron'
import { runAgent, clearPlanningSession } from '../services/agentEngine.js'
import { route } from '../services/modelRouter.js'
import { setCloudAPIBase, setCloudAPIKey, setCloudModel, setCloudProvider } from '../config.js'

let agentRunning = false
let currentAbortController = null

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
          // Remove planning system prompt, add normal prompt
          const execMessages = [
            { role: 'system', content: `You are a helpful AI assistant. Now execute the task based on the confirmed plan. Respond in Chinese.` },
            ...planResult.messages.filter(m => m.role !== 'system').slice(-20)
          ]
          reply = await runAgent(
            message, execMessages, progressCallback, chunkCallback, currentAbortController.signal
          )
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
    clearPlanningSession()
    return { success: true }
  })

  ipcMain.handle('agent:status', async () => {
    return { running: agentRunning }
  })
}

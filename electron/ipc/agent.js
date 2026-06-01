import { ipcMain } from 'electron'
import { runAgent } from '../services/agentEngine.js'
import { setCloudAPIBase, setCloudAPIKey, setCloudModel, setCloudProvider } from '../config.js'

let agentRunning = false
let currentAbortController = null

export function registerAgentIpc() {
  ipcMain.handle('agent:run', async (event, { message, aiMode, cloudConfig, history, pptCards }) => {
    console.log('[Agent] run request — mode:', aiMode, 'cloud:', !!cloudConfig?.key, 'model:', cloudConfig?.model, 'history:', history?.length)

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

    try {
      const contextMessages = (history || []).map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content }))
      if (pptCards?.length) {
        contextMessages.push({ role: 'system', content: `Previously generated PPT files: ${JSON.stringify(pptCards)}` })
      }
      const context = [{ aiMode }, ...contextMessages]

      const reply = await runAgent(
        message,
        context,
        (progress) => {
          try { event.sender.send('agent:progress', progress) } catch (_) {}
        },
        (chunk) => {
          chunkCount++
          console.log('[Agent] chunk', chunkCount, 'type:', chunk.type, 'len:', chunk.content?.length)
          try { event.sender.send('agent:chunk', chunk) } catch (_) {}
        },
        currentAbortController.signal
      )

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

  ipcMain.handle('agent:status', async () => {
    return { running: agentRunning }
  })
}

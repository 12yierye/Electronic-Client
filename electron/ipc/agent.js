import crypto from 'crypto'
import { ipcMain } from 'electron'
import { runAgent, clearPlanningSession, planningAgent } from '../services/agentEngine.js'
import { route } from '../services/modelRouter.js'
import { generatePPTX, generatePPTXFromMeta } from '../services/pptxGenerator.js'
import { generateHandout } from '../services/handoutGenerator.js'
import { searchImages } from '../services/imageSearch.js'
import fs from 'fs'
import { setCloudAPIBase, setCloudAPIKey, setCloudModel, setCloudProvider } from '../config.js'

const IPC_LOCALE = {
  'zh-CN': {
    designingPPTX: '📐 正在设计课件结构...\n',
    pptxGenerated: '课件已生成',
    genFailed: '生成失败',
    generatingPackage: '📦 正在生成教案包...\n',
    pptxGenFailed: 'PPTX生成失败',
    handoutGenerated: '📄 讲义已生成',
    handoutFailed: '讲义生成失败',
    packageDone: '✅ 教案包已生成\n📊 课件: {name}（{count}页）\n📄 讲义: {handout}',
    notGenerated: '未生成',
    agentRunning: 'Agent 正在运行中，请等待当前任务完成',
    taskDone: '任务已执行完毕。',
    planFailed: '规划失败',
    execPerPlan: '请根据以下确认的需求执行任务：{summary}。原始请求：{orig}'
  },
  'en': {
    designingPPTX: '📐 Designing courseware structure...\n',
    pptxGenerated: 'Courseware generated',
    genFailed: 'Generation failed',
    generatingPackage: '📦 Generating lesson package...\n',
    pptxGenFailed: 'PPTX generation failed',
    handoutGenerated: '📄 Handout generated',
    handoutFailed: 'Handout generation failed',
    packageDone: '✅ Lesson package generated\n📊 Courseware: {name}（{count} slides）\n📄 Handout: {handout}',
    notGenerated: 'Not generated',
    agentRunning: 'Agent is already running, please wait for the current task to complete',
    taskDone: 'Task has been executed.',
    planFailed: 'Planning failed',
    execPerPlan: 'Please execute the task according to the following confirmed requirements: {summary}. Original request: {orig}'
  },
  'ja': {
    designingPPTX: '📐 教材の構成を設計中...\n',
    pptxGenerated: '教材が生成されました',
    genFailed: '生成に失敗しました',
    generatingPackage: '📦 教案パッケージを生成中...\n',
    pptxGenFailed: 'PPTXの生成に失敗しました',
    handoutGenerated: '📄 配布資料が生成されました',
    handoutFailed: '配布資料の生成に失敗しました',
    packageDone: '✅ 教案パッケージが生成されました\n📊 教材: {name}（{count}ページ）\n📄 配布資料: {handout}',
    notGenerated: '未生成',
    agentRunning: 'Agent は実行中です。現在のタスクが完了するまでお待ちください',
    taskDone: 'タスクが実行されました。',
    planFailed: '計画に失敗しました',
    execPerPlan: '以下の確認された要件に従ってタスクを実行してください：{summary}。元のリクエスト：{orig}'
  }
}

function ipcT(locale, key, vars = {}) {
  const lang = locale?.startsWith('ja') ? 'ja' : locale?.startsWith('en') ? 'en' : 'zh-CN'
  let text = IPC_LOCALE[lang]?.[key] || IPC_LOCALE['zh-CN'][key] || key
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, v)
  }
  return text
}

let agentRunning = false
let currentAbortController = null
let currentSessionId = null

async function executePlannedTool(toolCall, toolParams, origMessage, progressCallback, chunkCallback, locale) {
  if (toolCall === 'generate_pptx') {
    chunkCallback({ type: 'reasoning', content: ipcT(locale, 'designingPPTX') })
    const result = await generatePPTX(toolParams, origMessage, progressCallback)
    if (result.success && result.path) {
      chunkCallback({ type: 'pptx_card', fileName: result.fileName, path: result.path, slideCount: result.slideCount, message: result.message })
    }
    return result.message || (result.success ? ipcT(locale, 'pptxGenerated') : `${ipcT(locale, 'genFailed')}: ${result.message}`)
  }
  if (toolCall === 'generate_lesson_package') {
    chunkCallback({ type: 'reasoning', content: ipcT(locale, 'generatingPackage') })
    const pptxResult = await generatePPTX(toolParams, origMessage, progressCallback)
    if (!pptxResult.success) return `${ipcT(locale, 'pptxGenFailed')}: ${pptxResult.message}`
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
    chunkCallback({ type: 'reasoning', content: handoutResult.success ? ipcT(locale, 'handoutGenerated') : `${ipcT(locale, 'handoutFailed')}: ${handoutResult.message}` })
    return ipcT(locale, 'packageDone', { name: pptxResult.fileName, count: pptxResult.slideCount || 0, handout: handoutResult.fileName || ipcT(locale, 'notGenerated') })
  }
  return null
}

export function registerAgentIpc() {
  ipcMain.handle('agent:run', async (event, { message, aiMode, cloudConfig, history, pptCards, planningMode, enableThinking, locale }) => {
    console.log('[Agent] run request — mode:', aiMode, 'cloud:', !!cloudConfig?.key, 'planning:', planningMode, 'thinking:', enableThinking, 'locale:', locale, 'history:', history?.length)

    if (agentRunning) {
      return { success: false, message: ipcT(locale, 'agentRunning') }
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
        const planResult = await planningAgent(sessionId, message, context, routing, progressCallback, chunkCallback, currentAbortController.signal, enableThinking, locale)

        if (planResult.action === 'ask') {
          reply = ''
        } else if (planResult.action === 'execute') {
          console.log('[Agent] planning execute, messages:', planResult.messages.length, 'toolCall:', planResult.toolCall)

          const summary = planResult.summary || ''
          const isPPTXTask = /课件|PPT|ppt|教案|讲义|演示|幻灯片|courseware|生成|制作|教材|作成|授業|資料/.test(summary) ||
                             /课件|PPT|ppt|教案|讲义|演示|幻灯片|courseware/.test(message)

          if (planResult.toolCall) {
            const directResult = await executePlannedTool(planResult.toolCall, planResult.toolParams || {}, message, progressCallback, chunkCallback, locale)
            reply = directResult || ipcT(locale, 'taskDone')
          } else if (isPPTXTask) {
            const toolParams = planResult.toolParams || { topic: summary || message, slideCount: 10 }
            const directResult = await executePlannedTool('generate_pptx', toolParams, message, progressCallback, chunkCallback, locale)
            reply = directResult || ipcT(locale, 'taskDone')
          } else {
            const conversationHistory = planResult.messages.filter(m => m.role !== 'system')
            const execMessage = planResult.summary
              ? ipcT(locale, 'execPerPlan', { summary: planResult.summary, orig: message })
              : message
            reply = await runAgent(
              execMessage, conversationHistory, progressCallback, chunkCallback, currentAbortController.signal, routing, true, enableThinking, locale
            )
          }
        } else {
          reply = planResult.error || ipcT(locale, 'planFailed')
        }
      } else {
        reply = await runAgent(
          message, context, progressCallback, chunkCallback, currentAbortController.signal, null, false, enableThinking, locale
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

  ipcMain.handle('agent:testImageSearch', async (_event, { query, provider }) => {
    const start = Date.now()
    try {
      const opts = { perPage: 3 }
      if (provider && provider !== 'all') opts.provider = provider
      const results = await searchImages(query || '教育', opts)
      const elapsed = Date.now() - start
      return { success: true, count: results.length, time: elapsed, firstUrl: results[0]?.url || null, images: results }
    } catch (e) {
      return { success: false, message: e.message }
    }
  })

  ipcMain.handle('agent:debugGeneratePPTX', async (event, { topic, slideCount, language }) => {
    const progressCallback = (progress) => {
      try { event.sender.send('agent:debugProgress', progress) } catch (_) {}
    }
    const result = await generatePPTX({ topic, slideCount, language, debug: true }, '', progressCallback)
    return result
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

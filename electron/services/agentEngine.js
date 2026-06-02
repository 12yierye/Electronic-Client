import axios from 'axios'
import { defaultRegistry } from './toolRegistry.js'
import { route } from './modelRouter.js'
import { generatePPTX, generatePPTXFromMeta } from './pptxGenerator.js'

const SYSTEM_PROMPT = `You are a helpful AI assistant for a school communication platform called Electronic. Respond in Chinese.`

const PLANNING_PROMPT = `你是一个任务规划助手。在执行任务前，你需要通过提问来完全理解用户的需求。

规则：
1. 每次只问一个问题，给出2-5个具体选项
2. 以JSON格式响应，不要有其他内容
3. 当你收集到足够信息后，输出 action: "ready"

输出格式 — 提问：
{"action":"ask","question":"请问什么科目？","options":["数学","语文","英语","其他","直接执行"]}

输出格式 — 确认可执行：
{"action":"ready","summary":"高二数学课件12页","plan":["步骤1","步骤2"]}`

const planningSessions = new Map()

function clearPlanningSession(sessionId) {
  planningSessions.delete(sessionId)
}

async function planningAgent(sessionId, message, context, routing, onProgress, onChunk, abortSignal) {
  let session = planningSessions.get(sessionId)
  const history = (context || []).filter(c => c.role)

  if (!session) {
    session = {
      messages: [{ role: 'system', content: PLANNING_PROMPT }, ...history, { role: 'user', content: message }],
      rounds: 0
    }
  } else {
    if (history.length > 0) session.messages.push(...history)
    else session.messages.push({ role: 'user', content: message })
  }

  session.rounds++
  if (session.rounds > 8) {
    planningSessions.delete(sessionId)
    onChunk({ type: 'reasoning', content: '\n已达到最大追问轮数，开始执行...' })
    return { action: 'execute', messages: session.messages }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (routing.apiKey) headers['Authorization'] = `Bearer ${routing.apiKey}`

  try {
    const res = await axios.post(routing.apiUrl, {
      model: routing.model || 'local',
      messages: session.messages,
      temperature: 0.5,
      max_tokens: 500
    }, { headers, timeout: 60000, signal: abortSignal })

    const raw = res.data?.choices?.[0]?.message?.content || ''
    console.log('[PlanAgent] raw response:', raw?.slice(0, 200))
    let parsed
    try { parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()) } catch {
      console.log('[PlanAgent] JSON parse failed, defaulting to execute')
      parsed = { action: 'ready', summary: message, plan: ['按需求执行'] }
    }

    console.log('[PlanAgent] parsed action:', parsed.action, 'hasQ:', !!parsed.question, 'opts:', parsed.options?.length)

    if (parsed.action === 'ask' && parsed.question && parsed.options?.length) {
      session.messages.push({ role: 'assistant', content: JSON.stringify(parsed) })
      planningSessions.set(sessionId, session)
      onChunk({ type: 'question', question: parsed.question, options: parsed.options })
      return { action: 'ask' }
    }

    planningSessions.delete(sessionId)
    return { action: 'execute', messages: session.messages }
  } catch (error) {
    if (error.name === 'CanceledError' || error.name === 'AbortError') {
      planningSessions.delete(sessionId)
      throw error
    }
    planningSessions.delete(sessionId)
    onProgress({ type: 'error', message: error.message })
    return { action: 'error', error: error.message }
  }
}

function parseSSEStream(response, abortSignal, onChunk) {
  return new Promise((resolve, reject) => {
    let fullContent = ''
    let streamBuffer = ''
    let resolved = false

    const finish = () => { if (resolved) return; resolved = true; resolve(fullContent) }

    response.data.on('data', (chunk) => {
      streamBuffer += chunk.toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const parts = streamBuffer.split('\n')
      streamBuffer = parts.pop() || ''
      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') { finish(); return }
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta || {}
          if (delta.content) { fullContent += delta.content; onChunk({ type: 'content', content: delta.content }) }
          if (delta.reasoning_content) onChunk({ type: 'reasoning', content: delta.reasoning_content })
        } catch {}
      }
    })

    response.data.on('end', finish)
    response.data.on('error', (err) => { if (!resolved) { resolved = true; reject(err) } })
    response.data.on('close', () => { if (!resolved) finish() })
    if (abortSignal) abortSignal.addEventListener('abort', () => { if (!resolved) { resolved = true; reject({ name: 'AbortError' }) } })
  })
}

async function runAgent(message, context, onProgress, onChunk, abortSignal) {
  const ctxItem = context?.find(c => c.aiMode) || {}
  const aiMode = ctxItem.aiMode || 'local'
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(context?.filter(c => c.role) || []),
    { role: 'user', content: message }
  ]
  let finalReply = ''
  let cancelled = false

  const agentCtx = {
    username: context?.username || 'user',
    downloadFile: context?.downloadFile || (async () => ({ success: false, message: '下载不可用' })),
    generatePPTX: (params) => generatePPTX(params, message, (prog) => {
      if (prog.type === 'pptx_progress') onChunk({ type: 'reasoning', content: prog.message || prog.step })
      onProgress(prog)
    }),
    editPPTX: (params) => generatePPTXFromMeta(params.pptxPath?.replace('.pptx', '.meta.json'), (prog) => {
      if (prog.type === 'pptx_progress') onChunk({ type: 'reasoning', content: prog.message || prog.step })
      onProgress(prog)
    })
  }

  for (let round = 0; round < 10; round++) {
    if (abortSignal?.aborted) { cancelled = true; break }

    const routing = await route(message, aiMode)
    if (routing.backend === 'none') { finalReply = routing.error; break }

    onProgress({ type: 'routing', backend: routing.backend, reason: routing.reason, round: round + 1 })

    const headers = { 'Content-Type': 'application/json' }
    if (routing.apiKey) headers['Authorization'] = `Bearer ${routing.apiKey}`

    const needsTools = /课件|PPT|ppt|教案|讲义|制作课件|生成课件/.test(message)
    const requestBody = { model: routing.model || 'local', messages, stream: true }
    if (needsTools && routing.supportsTools) { requestBody.tools = defaultRegistry.getAllTools(); requestBody.stream = false }

    try {
      if (needsTools && routing.supportsTools) {
        const res = await axios.post(routing.apiUrl, requestBody, { headers, timeout: 60000, signal: abortSignal })
        const choice = res.data?.choices?.[0]
        if (!choice) { finalReply = '模型返回为空'; break }
        const msg = choice.message
        const toolCalls = msg.tool_calls || []
        if (toolCalls.length === 0) { finalReply = msg.content || ''; break }
        messages.push({ role: 'assistant', content: msg.content || '', tool_calls: toolCalls })
        for (const tc of toolCalls) {
          const fn = tc.function || tc
          const tool = defaultRegistry.get(fn.name)
          onProgress({ type: 'tool_call', tool: fn.name, args: fn.arguments, round: round + 1 })
          if (!tool) { messages.push({ role: 'tool', tool_call_id: tc.id || '0', content: JSON.stringify({ error: `Tool: ${fn.name} not found` }) }); continue }
          try {
            const args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments
            const result = await tool.handler(args, agentCtx)
            const progressData = { type: 'tool_result', tool: fn.name, success: true, result }
            if (fn.name === 'generate_pptx' && result.success && result.path) {
              progressData.pptxCard = { fileName: result.fileName, path: result.path, slideCount: result.slideCount, message: result.message }
            }
            onProgress(progressData)
            if (progressData.pptxCard) onChunk({ type: 'pptx_card', ...progressData.pptxCard })
            messages.push({ role: 'tool', tool_call_id: tc.id || '0', content: JSON.stringify(result) })
          } catch (err) {
            onProgress({ type: 'tool_result', tool: fn.name, success: false, error: err.message })
            messages.push({ role: 'tool', tool_call_id: tc.id || '0', content: JSON.stringify({ error: err.message }) })
          }
        }
        continue
      }

      const res = await axios.post(routing.apiUrl, requestBody, { headers, timeout: 60000, responseType: 'stream', signal: abortSignal })
      const content = await parseSSEStream(res, abortSignal, onChunk)
      finalReply = ''
      break
    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') { cancelled = true; break }
      const msg = error.response?.data?.error?.message || error.message
      onProgress({ type: 'error', message: msg })
      finalReply = `抱歉：${msg}`
      break
    }
  }

  if (cancelled) { onProgress({ type: 'done' }); onChunk({ type: 'final', content: finalReply || '', cancelled: true }); return finalReply || '' }
  if (!finalReply) finalReply = '已完成所有操作。'
  onProgress({ type: 'done' })
  return finalReply
}

export { runAgent, clearPlanningSession }

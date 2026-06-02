import axios from 'axios'
import { defaultRegistry } from './toolRegistry.js'
import { route } from './modelRouter.js'
import { generatePPTX, generatePPTXFromMeta } from './pptxGenerator.js'
import { generateHandout } from './handoutGenerator.js'
import fs from 'fs'

const SYSTEM_PROMPT = `You are a helpful AI assistant for "Electronic", a school communication platform. Always respond in Chinese.

You have access to tools (functions) that you can call to help users:
- **generate_pptx**: Create PowerPoint courseware from a topic. Use when user asks to "制作课件", "生成PPT", "做个课件".
- **edit_pptx**: Modify an existing PPTX file (change content, add/remove slides, adjust styling). Use when user wants to modify a previously generated courseware.
- **generate_lesson_package**: Create a complete lesson package (PPTX + handout .docx + exercises). Use when user wants a full teaching package.
- **send_message**: Send a text message to a specific user. Use when user asks to message or contact someone.
- **send_broadcast**: Send a notification to organization members. Use when user wants to notify classes/grades.
- **list_files**: List files on the server.
- **download_file**: Download a file from another user.
- **get_org_tree**: View the school organization structure.
- **get_org_members**: Get members of an organization node.
- **search_contacts**: Search for users.
- **get_friends**: Get the user's friend list.
- **schedule_task**: Schedule a task for a specific time.
- **get_current_time**: Get current date and time.
- **get_user_info**: Get current user info.

Guidelines:
1. For simple greetings or factual questions, respond directly without tools.
2. When the user requests an action (generate, send, schedule, etc.), call the appropriate tool(s).
3. You may chain multiple tools — use the result of one tool as input to another.
4. For content generation (课件/教案), use generate_pptx or generate_lesson_package.
5. Always confirm tool execution results to the user with a brief summary.`

const TOOLS_AVAILABLE_HINT = `\n[System: You have access to function tools. When you need to perform an action, respond with tool_calls in the OpenAI function-calling format. Use the tools only when user intent requires them.]`

const PLANNING_PROMPT = `你是一个任务规划助手。在执行任务前，你需要通过提问来完全理解用户的需求。

规则：
1. 每次只问一个问题，给出2-5个具体选项。可多选时设置 multiSelect: true。
2. 当问题具有歧义（如多科目、多用途）时使用多选。简单单选（科目、页数）用单选。
3. 选项可附简要说明字段 desc 帮助用户理解（选填）。
4. 始终包含"其他"和"跳过"选项，放在末尾。
5. 以JSON格式响应，不要有其他内容。
6. 当你收集到足够信息后，输出 action: "ready"，并给出具体可执行计划。

输出格式 — 提问（单选）：
{"action":"ask","question":"请问什么科目？","options":[{"label":"数学","desc":"代数与几何"},{"label":"语文","desc":"古诗词"},{"label":"英语","desc":"语法与阅读"},{"label":"其他"},{"label":"跳过"}],"multiSelect":false}

输出格式 — 提问（多选）：
{"action":"ask","question":"需要包含哪些内容？","options":[{"label":"知识点","desc":"基础定义"},{"label":"例题","desc":"解题步骤"},{"label":"习题","desc":"课后练习"},{"label":"其他"},{"label":"跳过"}],"multiSelect":true}

输出格式 — 确认可执行（必须指明调用哪个工具及参数）：
{"action":"ready","summary":"高二数学课件12页","toolCall":"generate_pptx","toolParams":{"topic":"高二数学","detail":"12页课件","slideCount":12}}`

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
    return { action: 'execute', messages: session.messages, summary: message, toolCall: null, toolParams: null }
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
      const normalizedOptions = parsed.options.map(o => typeof o === 'string' ? { label: o } : o)
      session.messages.push({ role: 'assistant', content: JSON.stringify(parsed) })
      planningSessions.set(sessionId, session)
      onChunk({ type: 'question', question: parsed.question, options: normalizedOptions, multiSelect: !!parsed.multiSelect })
      return { action: 'ask' }
    }

    planningSessions.delete(sessionId)
    return {
      action: 'execute',
      messages: session.messages,
      summary: parsed.summary || message,
      toolCall: parsed.toolCall || null,
      toolParams: parsed.toolParams || null
    }
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

async function runAgent(message, context, onProgress, onChunk, abortSignal, preRouting, forceTools = false) {
  const ctxItem = context?.find(c => c.aiMode) || {}
  const aiMode = ctxItem.aiMode || 'local'
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(context?.filter(c => c.role) || []),
    { role: 'user', content: message }
  ]
  let finalReply = ''
  let cancelled = false
  let generatedPPTX = false

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
    }, params.instructions),
    generateHandout: (pptxResult, topic, outline) => generateHandout(pptxResult, topic, outline)
  }

  for (let round = 0; round < 10; round++) {
    if (abortSignal?.aborted) { cancelled = true; break }

    const routing = (round === 0 && preRouting)
      ? preRouting
      : await route(message, aiMode)
    if (routing.backend === 'none') { finalReply = routing.error; break }

    onProgress({ type: 'routing', backend: routing.backend, reason: routing.reason, round: round + 1 })

    const headers = { 'Content-Type': 'application/json' }
    if (routing.apiKey) headers['Authorization'] = `Bearer ${routing.apiKey}`

    const needsTools = forceTools || /课件|PPT|ppt|教案|讲义|制作课件|生成课件/.test(message)
    const canUseTools = forceTools || (needsTools && routing.supportsTools)
    const requestBody = { model: routing.model || 'local', messages, stream: true }
    if (canUseTools) {
      const toolMessages = [
        { role: 'system', content: SYSTEM_PROMPT + TOOLS_AVAILABLE_HINT + '\n重要：当前任务已经过规划确认，请立即调用对应工具执行，不要只输出文本。' },
        ...messages.filter(m => m.role !== 'system')
      ]
      requestBody.messages = toolMessages
      requestBody.tools = defaultRegistry.getAllTools()
      requestBody.stream = false
    }

    try {
      if (canUseTools) {
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
          if (fn.name === 'generate_pptx') {
            if (generatedPPTX) {
              messages.push({ role: 'tool', tool_call_id: tc.id || '0', content: JSON.stringify({ success: false, message: '课件已生成，请勿重复生成' }) })
              continue
            }
            generatedPPTX = true
          }
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
        if (forceTools) {
          finalReply = generatedPPTX ? '课件已生成，点击上方卡片即可打开。' : '任务已执行完毕。'
          break
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
  if (!finalReply) finalReply = generatedPPTX ? '课件已生成，点击上方卡片即可打开。' : '已完成所有操作。'
  onProgress({ type: 'done' })
  return finalReply
}

export { runAgent, clearPlanningSession, planningAgent }

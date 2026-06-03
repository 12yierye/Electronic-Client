import axios from 'axios'
import { defaultRegistry } from './toolRegistry.js'
import { route } from './modelRouter.js'
import { generatePPTX, generatePPTXFromMeta } from './pptxGenerator.js'
import { generateHandout } from './handoutGenerator.js'
import fs from 'fs'

const LOCALE_PROMPTS = {
  'zh-CN': {
    systemIntro: '你是一个名为"Electronic"的校园通讯与内容创作平台的 AI 助手。',
    alwaysRespond: '始终用中文回复。',
    execDefault: '按需求执行',
    toolPrefix: '你可以调用以下工具（函数）来帮助用户：',
    toolSuffix: '指南：\n1. 对于简单问候或事实性问题，直接回答，无需使用工具。\n2. 当用户请求执行操作（生成、发送、定时等）时，调用合适的工具。\n3. 你可以链式调用多个工具——将一个工具的结果作为另一个工具的输入。\n4. 对于内容生成（课件/教案），使用 generate_pptx 或 generate_lesson_package。\n5. 用简短的摘要向用户确认工具执行结果。',
    toolsAvailable: '你可以使用函数工具。当你需要执行操作时，使用 OpenAI function-calling 格式以 tool_calls 方式进行响应。仅在用户意图需要时使用工具。',
    forceToolsHint: '重要：当前任务已经过规划确认，请立即调用对应工具执行，不要只输出文本。',
    planningIntro: '你是一个任务规划助手。在执行任务前，你需要通过提问来完全理解用户的需求。',
    planningRules: '1. 每次只问一个问题，给出2-5个具体选项。可多选时设置 multiSelect: true。\n2. 当问题具有歧义（如多科目、多用途）时使用多选。简单单选（科目、页数）用单选。\n3. 选项可附简要说明字段 desc 帮助用户理解（选填）。\n4. 始终包含"其他"和"跳过"选项，放在末尾。\n5. 以JSON格式响应，不要有其他内容。\n6. 当你收集到足够信息后，输出 action: "ready"，并给出具体可执行计划。',
    planningOutputSingle: '输出格式 — 提问（单选）：\n{"action":"ask","question":"请问什么科目？","options":[{"label":"数学","desc":"代数与几何"},{"label":"语文","desc":"古诗词"},{"label":"英语","desc":"语法与阅读"},{"label":"其他"},{"label":"跳过"}],"multiSelect":false}',
    planningOutputMulti: '输出格式 — 提问（多选）：\n{"action":"ask","question":"需要包含哪些内容？","options":[{"label":"知识点","desc":"基础定义"},{"label":"例题","desc":"解题步骤"},{"label":"习题","desc":"课后练习"},{"label":"其他"},{"label":"跳过"}],"multiSelect":true}',
    planningReady: '输出格式 — 确认可执行（必须指明调用哪个工具及参数）：\n{"action":"ready","summary":"确认的需求摘要","toolCall":"generate_pptx","toolParams":{"topic":"主题","detail":"详情","slideCount":12}}',
    planningImageHint: '7. 生成的课件可自动嵌入配图和公式。配图自动通过网络搜索匹配。\n8. 涉及课件生成时，询问是否需要「动画过渡效果」（可选 fade/push/wipe/dissolve/split）。',
    maxRoundsReached: '已达到最大追问轮数，开始执行...',
    executePerPlan: '请根据以下确认的需求执行任务：',
    genPPtxProgress: '正在为您生成课件...',
    pptxGenerated: '课件已生成，点击上方 PPT 卡片即可打开查看完整课件。',
    pptxGeneratedSimple: '课件已生成，点击上方卡片即可打开。',
    taskDone: '任务已执行完毕。',
    allDone: '已完成所有操作。',
    modelEmpty: '模型返回为空',
    errorPrefix: '抱歉：'
  },
  'en': {
    systemIntro: 'You are a helpful AI assistant for "Electronic", a school communication and content creation platform.',
    alwaysRespond: 'Always respond in English.',
    execDefault: 'Execute as requested',
    toolPrefix: 'You have access to tools (functions) that you can call to help users:',
    toolSuffix: 'Guidelines:\n1. For simple greetings or factual questions, respond directly without tools.\n2. When the user requests an action (generate, send, schedule, etc.), call the appropriate tool(s).\n3. You may chain multiple tools — use the result of one tool as input to another.\n4. For content generation (courseware/lesson plans), use generate_pptx or generate_lesson_package.\n5. Always confirm tool execution results to the user with a brief summary.',
    toolsAvailable: 'You have access to function tools. When you need to perform an action, respond with tool_calls in the OpenAI function-calling format. Use the tools only when user intent requires them.',
    forceToolsHint: 'Important: The current task has been confirmed through planning. Please immediately call the corresponding tool to execute. Do not output only text.',
    planningIntro: 'You are a task planning assistant. Before executing a task, you need to fully understand the user\'s requirements through questions.',
    planningRules: '1. Ask only one question at a time, giving 2-5 specific options. Set multiSelect: true for multi-select.\n2. Use multi-select when the question is ambiguous (e.g., multiple subjects/purposes). Use single-select for simple choices (subject, page count).\n3. Options may include a brief description field "desc" to help users understand (optional).\n4. Always include "Other" and "Skip" options at the end.\n5. Respond in JSON format only, with no additional content.\n6. When you have collected sufficient information, output action: "ready" with a concrete executable plan.',
    planningOutputSingle: 'Output format — Question (single select):\n{"action":"ask","question":"What subject?","options":[{"label":"Math","desc":"Algebra & Geometry"},{"label":"English","desc":"Grammar & Reading"},{"label":"Science","desc":"Physics & Chem"},{"label":"Other"},{"label":"Skip"}],"multiSelect":false}',
    planningOutputMulti: 'Output format — Question (multi select):\n{"action":"ask","question":"What content to include?","options":[{"label":"Concepts","desc":"Basic definitions"},{"label":"Examples","desc":"Problem solving"},{"label":"Exercises","desc":"Practice problems"},{"label":"Other"},{"label":"Skip"}],"multiSelect":true}',
    planningReady: 'Output format — Ready to execute (must specify which tool and parameters):\n{"action":"ready","summary":"Confirmed requirement summary","toolCall":"generate_pptx","toolParams":{"topic":"Topic","detail":"Details","slideCount":12}}',
    planningImageHint: '7. Generated courseware can automatically embed images and formulas. Images are automatically searched online.\n8. When generating courseware, ask if they need "slide transition effects" (options: fade/push/wipe/dissolve/split).',
    maxRoundsReached: 'Maximum question rounds reached, starting execution...',
    executePerPlan: 'Please execute the task according to the following confirmed requirements:',
    genPPtxProgress: 'Generating courseware...',
    pptxGenerated: 'Courseware has been generated. Click the PPT card above to open and view the full courseware.',
    pptxGeneratedSimple: 'Courseware has been generated. Click the card above to open.',
    taskDone: 'Task has been executed.',
    allDone: 'All operations completed.',
    modelEmpty: 'Model returned empty',
    errorPrefix: 'Sorry: '
  },
  'ja': {
    systemIntro: 'あなたは「Electronic」という学校向けコミュニケーション・コンテンツ作成プラットフォームの AI アシスタントです。',
    alwaysRespond: '常に日本語で返信してください。',
    execDefault: 'リクエストに従って実行',
    toolPrefix: '次のツール（関数）を呼び出してユーザーを支援できます：',
    toolSuffix: 'ガイドライン：\n1. 簡単な挨拶や事実に関する質問には、ツールを使わず直接回答してください。\n2. ユーザーがアクション（生成、送信、スケジュールなど）を要求した場合は、適切なツールを呼び出してください。\n3. 複数のツールを連鎖して呼び出すことができます。一つのツールの結果を別のツールの入力として使用します。\n4. コンテンツ生成（教材/教案）には generate_pptx または generate_lesson_package を使用してください。\n5. ツールの実行結果を簡潔な要約でユーザーに確認してください。',
    toolsAvailable: '関数ツールを利用できます。操作を実行する必要がある場合は、OpenAI function-calling 形式で tool_calls として応答してください。ユーザーの意図がツールを必要とする場合にのみ使用してください。',
    forceToolsHint: '重要：現在のタスクは計画確認済みです。すぐに対応するツールを呼び出して実行してください。テキストのみを出力しないでください。',
    planningIntro: 'あなたはタスク計画アシスタントです。タスクを実行する前に、質問を通じてユーザーの要件を完全に理解する必要があります。',
    planningRules: '1. 一度に一つの質問のみ行い、2〜5個の具体的な選択肢を提供してください。複数選択の場合は multiSelect: true を設定します。\n2. 質問に曖昧さがある場合（複数の科目や用途など）は複数選択を使用します。単純な選択（科目、ページ数）には単一選択を使用します。\n3. 選択肢には簡単な説明フィールド desc を付けてユーザーの理解を助けることができます（任意）。\n4. 常に「その他」と「スキップ」の選択肢を末尾に含めてください。\n5. JSON形式のみで応答し、他の内容を含めないでください。\n6. 十分な情報を収集したら、action: "ready" を出力し、具体的な実行可能計画を提示してください。',
    planningOutputSingle: '出力形式 — 質問（単一選択）：\n{"action":"ask","question":"どの科目ですか？","options":[{"label":"数学","desc":"代数と幾何"},{"label":"国語","desc":"古典"},{"label":"英語","desc":"文法と読解"},{"label":"その他"},{"label":"スキップ"}],"multiSelect":false}',
    planningOutputMulti: '出力形式 — 質問（複数選択）：\n{"action":"ask","question":"含める内容は？","options":[{"label":"知識点","desc":"基本定義"},{"label":"例題","desc":"解法手順"},{"label":"練習問題","desc":"宿題"},{"label":"その他"},{"label":"スキップ"}],"multiSelect":true}',
    planningReady: '出力形式 — 実行確認（どのツールとパラメータを呼び出すかを必ず指定すること）：\n{"action":"ready","summary":"確認された要件の要約","toolCall":"generate_pptx","toolParams":{"topic":"トピック","detail":"詳細","slideCount":12}}',
    planningImageHint: '7. 生成された教材には自動的に画像と数式を埋め込むことができます。画像はネット検索で自動マッチングされます。\n8. 教材生成時に「スライド切り替え効果」が必要か尋ねてください（オプション：fade/push/wipe/dissolve/split）。',
    maxRoundsReached: '最大質問回数に達しました。実行を開始します...',
    executePerPlan: '以下の確認された要件に従ってタスクを実行してください：',
    genPPtxProgress: '教材を生成しています...',
    pptxGenerated: '教材が生成されました。上のPPTカードをクリックして完全な教材を開いて表示してください。',
    pptxGeneratedSimple: '教材が生成されました。上のカードをクリックして開いてください。',
    taskDone: 'タスクが実行されました。',
    allDone: 'すべての操作が完了しました。',
    modelEmpty: 'モデルの応答が空です',
    errorPrefix: '申し訳ありません：'
  }
}

function t(locale, key) {
  const lang = locale?.startsWith('ja') ? 'ja' : locale?.startsWith('en') ? 'en' : 'zh-CN'
  return LOCALE_PROMPTS[lang]?.[key] || LOCALE_PROMPTS['zh-CN'][key] || key
}

function buildSystemPrompt(locale) {
  return `${t(locale, 'systemIntro')} ${t(locale, 'alwaysRespond')}

${t(locale, 'toolPrefix')}
- **generate_pptx**: ${locale?.startsWith('ja') ? 'トピックからPowerPoint教材を作成。画像スライド（フリー画像自動検索）、数式スライド（LaTeX）、切り替えアニメーションをサポート。' : locale?.startsWith('en') ? 'Create PowerPoint courseware from a topic. Supports image slides (auto-searches free images), formula slides (LaTeX math), transition animations.' : '从主题生成 PowerPoint 课件。支持图片幻灯片（自动搜索免费图片）、公式幻灯片（LaTeX 数学）、过渡动画。'}
- **edit_pptx**: ${locale?.startsWith('ja') ? '既存のPPTXファイルを修正（内容変更、スライド追加/削除、スタイル調整）。' : locale?.startsWith('en') ? 'Modify an existing PPTX file (change content, add/remove slides, adjust styling).' : '修改已有的 PPTX 文件（内容更改、增加/删除幻灯片、调整样式）。'}
- **generate_lesson_package**: ${locale?.startsWith('ja') ? '完全な教案パッケージ（PPTX + 配布資料.docx + 練習問題）を作成。' : locale?.startsWith('en') ? 'Create a complete lesson package (PPTX + handout .docx + exercises).' : '创建完整教案包（PPTX + 讲义 .docx + 练习题）。'}
- **search_images**: ${locale?.startsWith('ja') ? 'キーワードでフリー素材画像を検索。教材に含める画像を探すために使用。' : locale?.startsWith('en') ? 'Search for free stock images by keyword. For finding images to include in courseware.' : '按关键词搜索免费图库图片。用于查找课件配图。'}
- **send_message**: ${locale?.startsWith('ja') ? '特定のユーザーにテキストメッセージを送信。' : locale?.startsWith('en') ? 'Send a text message to a specific user.' : '向指定用户发送文本消息。'}
- **send_broadcast**: ${locale?.startsWith('ja') ? '組織メンバーに通知を送信。クラス/学年への通知に使用。' : locale?.startsWith('en') ? 'Send a notification to organization members.' : '向组织成员发送通知。'}
- **list_files**: ${locale?.startsWith('ja') ? 'サーバー上のファイルを一覧表示。' : locale?.startsWith('en') ? 'List files on the server.' : '列出服务端文件列表。'}
- **download_file**: ${locale?.startsWith('ja') ? '他のユーザーからファイルをダウンロード。' : locale?.startsWith('en') ? 'Download a file from another user.' : '从其他用户处下载文件。'}
- **get_org_tree**: ${locale?.startsWith('ja') ? '学校の組織構造を表示。' : locale?.startsWith('en') ? 'View the school organization structure.' : '查看学校组织架构。'}
- **get_org_members**: ${locale?.startsWith('ja') ? '組織ノードのメンバーを取得。' : locale?.startsWith('en') ? 'Get members of an organization node.' : '获取组织节点成员。'}
- **search_contacts**: ${locale?.startsWith('ja') ? 'ユーザーを検索。' : locale?.startsWith('en') ? 'Search for users.' : '搜索用户。'}
- **get_friends**: ${locale?.startsWith('ja') ? '友達リストを取得。' : locale?.startsWith('en') ? 'Get the user\'s friend list.' : '获取用户的好友列表。'}
- **schedule_task**: ${locale?.startsWith('ja') ? '特定の時間にタスクをスケジュール。' : locale?.startsWith('en') ? 'Schedule a task for a specific time.' : '为指定时间安排定时任务。'}
- **get_current_time**: ${locale?.startsWith('ja') ? '現在の日時を取得。' : locale?.startsWith('en') ? 'Get current date and time.' : '获取当前日期和时间。'}
- **get_user_info**: ${locale?.startsWith('ja') ? '現在のユーザー情報を取得。' : locale?.startsWith('en') ? 'Get current user info.' : '获取当前用户信息。'}

${t(locale, 'toolSuffix')}`
}

function buildPlanningPrompt(locale) {
  return `${t(locale, 'planningIntro')}

${locale?.startsWith('ja') ? 'ルール：' : locale?.startsWith('en') ? 'Rules:' : '规则：'}
${t(locale, 'planningRules')}

${t(locale, 'planningOutputSingle')}

${t(locale, 'planningOutputMulti')}

${t(locale, 'planningImageHint')}

${t(locale, 'planningReady')}`
}

function buildToolsAvailableHint(locale) {
  return `\n[System: ${t(locale, 'toolsAvailable')}]`
}

function buildForceToolsHint(locale) {
  return `\n${t(locale, 'forceToolsHint')}`
}

const planningSessions = new Map()

function clearPlanningSession(sessionId) {
  planningSessions.delete(sessionId)
}

async function planningAgent(sessionId, message, context, routing, onProgress, onChunk, abortSignal, enableThinking = false, locale = 'zh-CN') {
  let session = planningSessions.get(sessionId)
  const history = (context || []).filter(c => c.role)

  if (!session) {
    session = {
      messages: [{ role: 'system', content: buildPlanningPrompt(locale) }, ...history, { role: 'user', content: message }],
      rounds: 0
    }
  } else {
    if (history.length > 0) session.messages.push(...history)
    else session.messages.push({ role: 'user', content: message })
  }

  session.rounds++
  if (session.rounds > 8) {
    planningSessions.delete(sessionId)
    onChunk({ type: 'reasoning', content: '\n' + t(locale, 'maxRoundsReached') })
    return { action: 'execute', messages: session.messages, summary: message, toolCall: null, toolParams: null }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (routing.apiKey) headers['Authorization'] = `Bearer ${routing.apiKey}`

  try {
    const res = await axios.post(routing.apiUrl, {
      model: routing.model || 'local',
      messages: session.messages,
      temperature: 0.5,
      max_tokens: 500,
      ...(enableThinking ? { enable_thinking: true } : {})
    }, { headers, timeout: 60000, signal: abortSignal })

    const raw = res.data?.choices?.[0]?.message?.content || ''
    console.log('[PlanAgent] raw response:', raw?.slice(0, 200))
    let parsed
    try { parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()) } catch {
      console.log('[PlanAgent] JSON parse failed, defaulting to execute')
      parsed = { action: 'ready', summary: message, plan: [t(locale, 'execDefault')] }
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

async function runAgent(message, context, onProgress, onChunk, abortSignal, preRouting, forceTools = false, enableThinking = false, locale = 'zh-CN') {
  const ctxItem = context?.find(c => c.aiMode) || {}
  const aiMode = ctxItem.aiMode || 'local'
  const messages = [
    { role: 'system', content: buildSystemPrompt(locale) },
    ...(context?.filter(c => c.role) || []),
    { role: 'user', content: message }
  ]
  let finalReply = ''
  let cancelled = false
  let generatedPPTX = false

  const agentCtx = {
    username: context?.username || 'user',
    downloadFile: context?.downloadFile || (async () => ({ success: false, message: locale?.startsWith('ja') ? 'ダウンロード不可' : locale?.startsWith('en') ? 'Download unavailable' : '下载不可用' })),
    generatePPTX: (params) => {
      onChunk({ type: 'content', content: '**' + t(locale, 'genPPtxProgress') + '**\n\n' })
      return generatePPTX(params, message, (prog) => {
        if (prog.type === 'pptx_progress') {
          const stepMsg = `> ${prog.message || prog.step}...\n`
          onChunk({ type: 'content', content: stepMsg })
        }
        onProgress(prog)
      })
    },
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

    const needsTools = forceTools || /课件|PPT|ppt|教案|讲义|制作课件|生成课件|演示|幻灯片|create|make|生成|制作|做一份|帮我做|教材|作成|授業|教案|資料/.test(message)
    const canUseTools = forceTools || (needsTools && routing.supportsTools)
    const requestBody = { model: routing.model || 'local', messages, stream: true }
    if (enableThinking) {
      requestBody.enable_thinking = true
    }
    if (canUseTools) {
      const toolMessages = [
        { role: 'system', content: buildSystemPrompt(locale) + buildToolsAvailableHint(locale) + buildForceToolsHint(locale) },
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
        if (!choice) { finalReply = t(locale, 'modelEmpty'); break }
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
            if (fn.name === 'search_images' && result.success && result.images?.length) {
              progressData.images = result.images
            }
            onProgress(progressData)
            if (progressData.pptxCard) onChunk({ type: 'pptx_card', ...progressData.pptxCard })
            if (progressData.images) onChunk({ type: 'image_gallery', images: progressData.images, query: args.query })
            messages.push({ role: 'tool', tool_call_id: tc.id || '0', content: JSON.stringify(result) })
          } catch (err) {
            onProgress({ type: 'tool_result', tool: fn.name, success: false, error: err.message })
            messages.push({ role: 'tool', tool_call_id: tc.id || '0', content: JSON.stringify({ error: err.message }) })
          }
        }
        if (forceTools) {
          finalReply = generatedPPTX ? t(locale, 'pptxGenerated') : t(locale, 'taskDone')
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
      finalReply = `${t(locale, 'errorPrefix')}${msg}`
      break
    }
  }

  if (cancelled) { onProgress({ type: 'done' }); onChunk({ type: 'final', content: finalReply || '', cancelled: true }); return finalReply || '' }
  if (!finalReply) finalReply = generatedPPTX ? t(locale, 'pptxGeneratedSimple') : t(locale, 'allDone')
  onProgress({ type: 'done' })
  return finalReply
}

export { runAgent, clearPlanningSession, planningAgent }

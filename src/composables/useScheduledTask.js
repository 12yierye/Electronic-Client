export function parseScheduledIntent(message) {
  const normalizedMessage = message.replace(/：/g, ':')

  const timePatterns = [
    /在\s*(\d{1,2}:\d{2})/,
    /(\d{1,2}:\d{2})/,
    /(\d+)\s*分钟\s*后/
  ]

  const fileExtensions = ['docx', 'xlsx', 'pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'zip', 'rar', '7z', 'pptx', 'doc', 'xls', 'csv', 'npmrc']

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

  for (const pattern of timePatterns) {
    const match = normalizedMessage.match(pattern)
    if (match) {
      if (match[1] && pattern.toString().includes('分钟')) {
        minutesLater = parseInt(match[1])
        time = minutesLater
      } else {
        time = match[1] || match[0]
      }
      break
    }
  }

  const fileMatch = normalizedMessage.match(fileNamePattern)
  if (fileMatch) {
    filename = fileMatch[1]
    isFile = true
  }

  const userMatch1 = normalizedMessage.match(/向\s*(\S+?)\s+(?:发送|发给|发送给|说|发)/)
  if (userMatch1) {
    targetUser = userMatch1[1]
  } else {
    const userMatch2 = normalizedMessage.match(/发给\s*(\S+?)\s+(?:发送|发给|发送给|说|发)/)
    if (userMatch2) {
      targetUser = userMatch2[1]
    }
  }

  if (!isFile) {
    const textContentMatch = normalizedMessage.match(/说\s*(.+)$/)
    if (textContentMatch) {
      content = textContentMatch[1].trim()
    }
  }

  const hasTime = time !== null || minutesLater !== null

  if (isFile && hasTime && targetUser && filename) {
    return { type: 'file', ...(minutesLater ? { immediate: true, minutesLater } : { time }), targetUser, filename }
  }

  if (hasTime && targetUser && content) {
    return { type: 'text', ...(minutesLater ? { immediate: true, minutesLater } : { time }), targetUser, content }
  }

  if (!hasTime && isFile && targetUser && filename) {
    return { type: 'file', immediate: true, targetUser, filename }
  }

  if (!hasTime && targetUser && content) {
    return { type: 'text', immediate: true, targetUser, content }
  }

  return null
}

export async function executeFunctionCall(functionName, params, scheduleTime, timeStr, currentUsername, message, aiStore, t) {
  console.log('[AI] execute:', functionName, params.targetUser)

  if (functionName === 'schedule_file_send') {
    console.log('[AI] schedule file:', params.filename, '@', scheduleTime)

    const filesResult = await window.electronAPI.getUserFiles(currentUsername)
    if (!filesResult.success || !filesResult.files) {
      aiStore.addUserMessage(message)
      aiStore.addAIMessage(t('scheduledTask.fileNotUploaded', { filename: params.filename }))
      return
    }

    const fileExists = filesResult.files.some(f => f.filename === params.filename)
    if (!fileExists) {
      aiStore.addUserMessage(message)
      const fileListStr = filesResult.files.map(f => f.filename).join('、')
      aiStore.addAIMessage(t('scheduledTask.fileNotFound', { filename: params.filename, fileList: fileListStr }))
      return
    }

    const result = await window.electronAPI.scheduleFileSend(scheduleTime, params.targetUser, params.filename, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(t('scheduledTask.scheduleFileSuccess', { timeStr, targetUser: params.targetUser, filename: params.filename }))
    } else {
      aiStore.addAIMessage(t('scheduledTask.scheduleFileFailed', { message: result.message }))
    }

  } else if (functionName === 'schedule_message_send') {
    console.log('[AI] schedule msg:', params.targetUser, '@', scheduleTime)

    const result = await window.electronAPI.scheduleMessageSend(scheduleTime, params.targetUser, params.content, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(t('scheduledTask.scheduleMsgSuccess', { timeStr, targetUser: params.targetUser, content: params.content }))
    } else {
      aiStore.addAIMessage(t('scheduledTask.scheduleMsgFailed', { message: result.message }))
    }

  } else if (functionName === 'send_file_now') {
    console.log('[AI] send file now:', params.filename, '->', params.targetUser)

    const filesResult = await window.electronAPI.getUserFiles(currentUsername)
    if (!filesResult.success || !filesResult.files) {
      aiStore.addAIMessage(t('scheduledTask.fileNotUploaded', { filename: params.filename }))
      return
    }

    const fileExists = filesResult.files.some(f => f.filename === params.filename)
    if (!fileExists) {
      const fileListStr = filesResult.files.map(f => f.filename).join('、')
      aiStore.addAIMessage(t('scheduledTask.fileNotFound', { filename: params.filename, fileList: fileListStr }))
      return
    }

    const result = await window.electronAPI.sendFileNow(params.targetUser, params.filename, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(t('scheduledTask.sendFileNow', { targetUser: params.targetUser, filename: params.filename }))
    } else {
      aiStore.addAIMessage(t('scheduledTask.sendFileFailed', { message: result.message }))
    }

  } else if (functionName === 'send_message_now') {
    console.log('[AI] send msg now:', params.targetUser)

    const result = await window.electronAPI.sendMessageNow(params.targetUser, params.content, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(t('scheduledTask.sendMsgNow', { targetUser: params.targetUser }))
    } else {
      aiStore.addAIMessage(t('scheduledTask.sendMsgFailed', { message: result.message }))
    }

  } else {
    aiStore.addAIMessage(t('scheduledTask.cannotExecute', { functionName }))
  }
}

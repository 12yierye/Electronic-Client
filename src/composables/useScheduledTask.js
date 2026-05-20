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

export async function executeFunctionCall(functionName, params, scheduleTime, timeStr, currentUsername, message, aiStore) {
  console.log('[AI] execute:', functionName, params.targetUser)

  if (functionName === 'schedule_file_send') {
    console.log('[AI] schedule file:', params.filename, '@', scheduleTime)

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
    console.log('[AI] schedule msg:', params.targetUser, '@', scheduleTime)

    const result = await window.electronAPI.scheduleMessageSend(scheduleTime, params.targetUser, params.content, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(`好的！我已安排在 ${timeStr} 向 "${params.targetUser}" 发送消息："${params.content}"。`)
    } else {
      aiStore.addAIMessage(`抱歉，设置定时发送失败: ${result.message}`)
    }

  } else if (functionName === 'send_file_now') {
    console.log('[AI] send file now:', params.filename, '->', params.targetUser)

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
    console.log('[AI] send msg now:', params.targetUser)

    const result = await window.electronAPI.sendMessageNow(params.targetUser, params.content, currentUsername)

    if (result.success) {
      aiStore.addAIMessage(`好的！消息已立即发送给 "${params.targetUser}"。`)
    } else {
      aiStore.addAIMessage(`抱歉，发送消息失败: ${result.message}`)
    }

  } else {
    aiStore.addAIMessage(`抱歉，我无法执行该操作：${functionName}`)
  }
}

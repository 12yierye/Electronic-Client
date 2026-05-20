import fs from 'fs'
import axios from 'axios'
import { API_BASE, SCHEDULED_TASKS_FILE } from '../config.js'

export const scheduledTasks = new Map()

export const saveScheduledTasks = () => {
  try {
    const tasksData = []
    for (const [taskId, taskInfo] of scheduledTasks) {
      tasksData.push({
        taskId,
        scheduleTime: taskInfo.scheduleTime,
        targetUser: taskInfo.targetUser,
        filename: taskInfo.filename,
        content: taskInfo.content,
        currentUser: taskInfo.currentUser,
        type: taskInfo.type
      })
    }
    fs.writeFileSync(SCHEDULED_TASKS_FILE, JSON.stringify(tasksData, null, 2))
    console.log('[Scheduled] Saved', tasksData.length, 'Tasks')
  } catch (err) {
    console.error('[Scheduled] Save Failed:', err.message)
  }
}

export const restoreScheduledTasks = () => {
  try {
    if (!fs.existsSync(SCHEDULED_TASKS_FILE)) return
    const raw = fs.readFileSync(SCHEDULED_TASKS_FILE, 'utf-8')
    const tasksData = JSON.parse(raw)
    console.log('[Scheduled] Restoring', tasksData.length, 'Tasks')

    const now = Date.now()
    for (const taskData of tasksData) {
      const scheduledTime = new Date(taskData.scheduleTime).getTime()
      const delay = scheduledTime - now

      if (delay <= 0) {
        console.log('[Scheduled] Skip Expired:', taskData.taskId)
        continue
      }

      const task = setTimeout(async () => {
        try {
          await executeScheduledTask(taskData)
          scheduledTasks.delete(taskData.taskId)
          saveScheduledTasks()
        } catch (err) {
          console.error('[Scheduled] task failed:', taskData.taskId, err.message)
        }
      }, delay)

      scheduledTasks.set(taskData.taskId, {
        task,
        scheduleTime: taskData.scheduleTime,
        targetUser: taskData.targetUser,
        filename: taskData.filename,
        content: taskData.content,
        currentUser: taskData.currentUser,
        type: taskData.type
      })
      console.log('[Scheduled] restored:', taskData.taskId, '@', taskData.scheduleTime)
    }
  } catch (err) {
    console.error('[Scheduled] restore failed:', err.message)
  }
}

export const clearAllScheduledTasks = () => {
  for (const [taskId, taskInfo] of scheduledTasks) {
    clearTimeout(taskInfo.task)
  }
  scheduledTasks.clear()
}

export const executeScheduledTask = async (taskData) => {
  if (taskData.type === 'file') {
    const downloadResponse = await axios.get(
      `${API_BASE}/user/download?username=${taskData.currentUser}&filename=${taskData.filename}`,
      { responseType: 'arraybuffer' }
    )
    await axios.post(
      `${API_BASE}/user/upload?username=${taskData.targetUser}&filename=${taskData.filename}`,
      downloadResponse.data,
      { headers: { 'Content-Type': 'application/octet-stream' } }
    )
    const chatMessageData = {
      sender: taskData.currentUser,
      receiver: taskData.targetUser,
      content: `[定时发送文件] ${taskData.filename}`,
      type: 'file',
      fileInfo: { filename: taskData.filename, isScheduled: true }
    }
    await axios.post(`${API_BASE}/chat/send`, chatMessageData)
    console.log('[Scheduled] file sent:', taskData.filename, '->', taskData.targetUser)
  } else if (taskData.type === 'message') {
    const chatMessageData = {
      sender: taskData.currentUser,
      receiver: taskData.targetUser,
      content: taskData.content,
      type: 'text',
      isScheduled: true
    }
    await axios.post(`${API_BASE}/chat/send`, chatMessageData)
    console.log('[Scheduled] msg sent:', taskData.content?.substring(0, 30), '->', taskData.targetUser)
  }
}

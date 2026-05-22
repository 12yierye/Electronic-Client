import { ipcMain } from 'electron'
import axios from 'axios'
import { getAPIBase } from '../config.js'
import { scheduledTasks, saveScheduledTasks, executeScheduledTask } from '../services/scheduledTasks.js'

export function registerTaskIpc() {
    ipcMain.handle('schedule-file-send', async (event, scheduleTime, targetUser, filename, currentUser) => {
        try {
            console.log('[SchedFile]', targetUser, filename, '@', scheduleTime)

            const filesResponse = await axios.get(`${getAPIBase()}/user/files/${currentUser}`)
            if (!filesResponse.data.success || !filesResponse.data.files) {
                return { success: false, message: '无法获取文件列表' }
            }

            const fileInfo = filesResponse.data.files.find(f => f.filename === filename)
            if (!fileInfo) {
                return { success: false, message: `文件 "${filename}" 不存在` }
            }

            const delay = new Date(scheduleTime).getTime() - Date.now()
            if (delay <= 0) {
                return { success: false, message: '定时时间必须是未来时间' }
            }

            const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
            const taskData = { type: 'file', scheduleTime, targetUser, filename, currentUser }
            const task = setTimeout(async () => {
                try {
                    await executeScheduledTask(taskData)
                    console.log('[SchedFile] done:', filename, '->', targetUser)
                    scheduledTasks.delete(taskId)
                    saveScheduledTasks()
                } catch (err) {
                    console.error('[SchedFile] failed:', err.message)
                    scheduledTasks.delete(taskId)
                    saveScheduledTasks()
                }
            }, delay)

            scheduledTasks.set(taskId, { task, ...taskData })

            console.log('[SchedFile] task created:', taskId, '@', scheduleTime)
            return { success: true, taskId, scheduleTime }
        } catch (error) {
            console.error('[SchedFile] error:', error.message)
            return { success: false, message: error.message }
        }
    })

    ipcMain.handle('schedule-message-send', async (event, scheduleTime, targetUser, content, currentUser) => {
        try {
            console.log('[SchedMsg]', targetUser, '@', scheduleTime)

            const delay = new Date(scheduleTime).getTime() - Date.now()
            if (delay <= 0) {
                return { success: false, message: '定时时间必须是未来时间' }
            }

            const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
            const taskData = { type: 'message', scheduleTime, targetUser, content, currentUser }
            const task = setTimeout(async () => {
                try {
                    await executeScheduledTask(taskData)
                    console.log('[SchedMsg] done:', targetUser)
                    scheduledTasks.delete(taskId)
                    saveScheduledTasks()
                } catch (err) {
                    console.error('[SchedMsg] failed:', err.message)
                    scheduledTasks.delete(taskId)
                    saveScheduledTasks()
                }
            }, delay)

            scheduledTasks.set(taskId, { task, ...taskData })
            saveScheduledTasks()

            console.log('[SchedMsg] task created:', taskId, '@', scheduleTime)
            return { success: true, taskId, scheduleTime }
        } catch (error) {
            console.error('[SchedMsg] error:', error.message)
            return { success: false, message: error.message }
        }
    })

    ipcMain.handle('send-file-now', async (event, targetUser, filename, currentUser) => {
        try {
            console.log('[SendNow] file:', filename, '->', targetUser)

            const filesResponse = await axios.get(`${getAPIBase()}/user/files/${currentUser}`)
            if (!filesResponse.data.success || !filesResponse.data.files) {
                return { success: false, message: '无法获取文件列表' }
            }

            const fileInfo = filesResponse.data.files.find(f => f.filename === filename)
            if (!fileInfo) {
                return { success: false, message: `文件 "${filename}" 不存在` }
            }

            const downloadResponse = await axios.get(
                `${getAPIBase()}/user/download?username=${currentUser}&filename=${filename}`,
                { responseType: 'arraybuffer' }
            )

            await axios.post(
                `${getAPIBase()}/user/upload?username=${targetUser}&filename=${filename}`,
                downloadResponse.data,
                { headers: { 'Content-Type': 'application/octet-stream' } }
            )

            console.log('[Send File Now] 文件发送成功:', filename, '->', targetUser)

            const chatMessageData = {
                sender: currentUser,
                receiver: targetUser,
                content: `[发送文件] ${filename}`,
                type: 'file',
                fileInfo: { filename: filename, isScheduled: false }
            }
            await axios.post(`${getAPIBase()}/chat/send`, chatMessageData)

            console.log('[SendNow] file done:', filename, '->', targetUser)
            return { success: true, message: `文件 "${filename}" 已发送给 "${targetUser}"` }
        } catch (error) {
            console.error('[SendNow] file error:', error.message)
            return { success: false, message: error.message }
        }
    })

    ipcMain.handle('send-message-now', async (event, targetUser, content, currentUser) => {
        try {
            console.log('[SendNow] msg:', targetUser)

            const chatMessageData = {
                sender: currentUser,
                receiver: targetUser,
                content: content,
                type: 'text',
                isScheduled: false
            }
            await axios.post(`${getAPIBase()}/chat/send`, chatMessageData)

            console.log('[SendNow] msg done:', targetUser)
            return { success: true, message: `消息已发送给 "${targetUser}"` }
        } catch (error) {
            console.error('[SendNow] msg error:', error.message)
            return { success: false, message: error.message }
        }
    })
}

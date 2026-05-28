import { ipcMain } from 'electron'
import axios from 'axios'
import { getAPIBase } from '../config.js'
import { getErrorHint } from '../config.js'

export function registerUserIpc() {
    ipcMain.handle('get-user-list', async () => {
        try { return (await axios.get(`${getAPIBase()}/users`)).data }
        catch (error) {
            console.error('[Get User List] failed:', error.message)
            return { success: false, message: error.message }
        }
    })

    ipcMain.handle('get-friends-list', async (event, username) => {
        try { return (await axios.get(`${getAPIBase()}/users/friends?username=${username}`)).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('test-server-connection', async () => {
        try {
            console.log('[Test Connection] probing', getAPIBase())
            const response = await axios.get(`${getAPIBase()}/health`, { timeout: 3000 })
            console.log('[Test Connection] ok')
            return { success: true, message: '连接成功', data: response.data }
        } catch (error) {
            console.error('[Test Connection] failed:', error.message)
            return {
                success: false,
                message: `连接失败 (${error.code})`,
                details: {
                    code: error.code,
                    baseURL: getAPIBase(),
                    hint: getErrorHint(error.code)
                }
            }
        }
    })

    ipcMain.handle('get-friend-requests', async (event, username, type) => {
        try { return (await axios.get(`${getAPIBase()}/friends/requests?username=${username}&type=${type || 'received'}`)).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('handle-friend-request', async (event, requestId, action) => {
        try { return (await axios.post(`${getAPIBase()}/friends/requests/handle`, { requestId, action })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('send-friend-request', async (event, sender, receiver) => {
        try { return (await axios.post(`${getAPIBase()}/friends/requests/send`, { sender, receiver })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('search-users', async (event, searchTerm) => {
        try { return (await axios.get(`${getAPIBase()}/users/search?query=${searchTerm}`)).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('add-friend', async (event, currentUser, friendUsername) => {
        try { return (await axios.post(`${getAPIBase()}/users/friends/add`, { currentUser, friendUsername })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('remove-friend', async (event, currentUser, friendUsername) => {
        try { return (await axios.post(`${getAPIBase()}/users/friends/remove`, { currentUser, friendUsername })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('star-user', async (event, currentUser, starredUsername) => {
        try { return (await axios.post(`${getAPIBase()}/users/star`, { currentUser, starredUsername })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('get-starred-users', async (event, username) => {
        try { return (await axios.get(`${getAPIBase()}/users/starred?username=${username}`)).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('send-chat-message', async (event, messageData) => {
        try { return (await axios.post(`${getAPIBase()}/chat/send`, messageData)).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('get-chat-messages', async (event, sender, receiver) => {
        try { return (await axios.get(`${getAPIBase()}/chat/messages?sender=${sender}&receiver=${receiver}`)).data }
        catch (error) { return { success: false, message: error.message } }
    })

    // ========== 公网群聊 ==========

    ipcMain.handle('get-groups', async (event, username) => {
        try { return (await axios.get(`${getAPIBase()}/api/groups?username=${encodeURIComponent(username)}`)).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('create-group', async (event, data) => {
        try { return (await axios.post(`${getAPIBase()}/api/groups`, data)).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('disband-group', async (event, groupId, username) => {
        try { return (await axios.delete(`${getAPIBase()}/api/groups/${groupId}`, { data: { username } })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('get-group-messages', async (event, groupId) => {
        try { return (await axios.get(`${getAPIBase()}/api/group-messages?groupId=${encodeURIComponent(groupId)}`)).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('send-group-message', async (event, groupId, from, message, type) => {
        try { return (await axios.post(`${getAPIBase()}/api/group-messages`, { groupId, from, message, type: type || 'text' })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('join-group', async (event, groupId, username) => {
        try { return (await axios.post(`${getAPIBase()}/api/groups/join`, { groupId, username })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('get-unread-counts', async (event, username, readPoints) => {
        try { return (await axios.post(`${getAPIBase()}/chat/unread-counts`, { username, readPoints })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('mark-chat-read', async (event, username, target, lastReadId) => {
        try { return (await axios.post(`${getAPIBase()}/chat/mark-read`, { username, target, lastReadId })).data }
        catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('mark-group-read', async (event, username, groupId, lastReadId) => {
        try { return (await axios.post(`${getAPIBase()}/chat/mark-read-group`, { username, groupId, lastReadId })).data }
        catch (error) { return { success: false, message: error.message } }
    })
}

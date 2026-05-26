import { app, ipcMain, dialog } from 'electron'
import { join, parse } from 'node:path'
import axios from 'axios'
import fs from 'fs'
import { getAPIBase, getDownloadDir, setDownloadDir } from '../config.js'

function getNextAvailableName(dir, name) {
    const parsed = parse(name)
    const base = parsed.name
    const ext = parsed.ext
    let counter = 2
    let newName = `${base} ${counter}${ext}`
    while (fs.existsSync(join(dir, newName))) {
        counter++
        newName = `${base} ${counter}${ext}`
    }
    return newName
}

export function registerFileIpc() {
    ipcMain.handle('download-file', async (event, username, filename) => {
        const downloadsDir = getDownloadDir()
        const tempFilename = filename + '.part'
        let finalPath = join(downloadsDir, filename)
        const tempPath = join(downloadsDir, tempFilename)

        try {
            if (!fs.existsSync(downloadsDir)) {
                fs.mkdirSync(downloadsDir, { recursive: true })
            }

            if (fs.existsSync(finalPath)) {
                const { response } = await dialog.showMessageBox({
                    type: 'warning',
                    title: '文件已存在',
                    message: `文件 "${filename}" 已存在于下载目录中。`,
                    detail: `路径：${finalPath}`,
                    buttons: ['替换', '重命名', '取消'],
                    defaultId: 0,
                    cancelId: 2
                })
                if (response === 0) {
                    // 替换：继续使用原路径，下载时会覆盖
                } else if (response === 1) {
                    const newName = getNextAvailableName(downloadsDir, filename)
                    finalPath = join(downloadsDir, newName)
                } else {
                    return { success: false, message: '用户取消了下载' }
                }
            }

            const response = await axios({
                method: 'GET',
                url: `${getAPIBase()}/user/download/${encodeURIComponent(username)}/${encodeURIComponent(filename)}`,
                responseType: 'stream',
                onDownloadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                    try {
                        event.sender.send('download-progress', { filename, percentCompleted })
                    } catch (_) {}
                }
            })

            const writer = fs.createWriteStream(tempPath)

            const finalFilename = parse(finalPath).base

            return new Promise((resolve, reject) => {
                response.data.pipe(writer)
                writer.on('finish', () => {
                    fs.renameSync(tempPath, finalPath)
                    resolve({ success: true, message: `文件下载成功：${finalFilename}` })
                })
                writer.on('error', (err) => {
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
                    reject(err)
                })
            })
        } catch (error) {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
            return { success: false, message: error.message }
        }
    })

    ipcMain.handle('upload-file', async (event, username, filename, fileData) => {
        try {
            const response = await axios.post(`${getAPIBase()}/user/upload?username=${encodeURIComponent(username)}&filename=${encodeURIComponent(filename)}`, fileData, { headers: { 'Content-Type': 'application/octet-stream' } })
            return response.data
        } catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('delete-file', async (event, username, filename) => {
        try {
            const response = await axios.delete(`${getAPIBase()}/user/file/${encodeURIComponent(username)}/${encodeURIComponent(filename)}`)
            return response.data
        } catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('get-user-files', async (event, username) => {
        try {
            const response = await axios.get(`${getAPIBase()}/user/files?username=${encodeURIComponent(username)}`)
            return response.data
        } catch (error) {
            console.error('[GetUserFiles] err:', error.message)
            return { success: false, message: error.message }
        }
    })

    ipcMain.handle('get-all-files', async () => {
        try {
            const response = await axios.get(`${getAPIBase()}/files/all`)
            return response.data
        } catch (error) {
            console.error('[GetAllFiles] err:', error.message)
            return { success: false, message: error.message }
        }
    })

    ipcMain.handle('set-download-dir', async (event, dir) => {
        setDownloadDir(dir)
        return { success: true }
    })

    ipcMain.handle('get-download-dir', () => {
        return { success: true, dir: getDownloadDir() }
    })

    ipcMain.handle('select-directory', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: '选择下载目录'
        })
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, dir: null }
        }
        return { success: true, dir: result.filePaths[0] }
    })

    ipcMain.handle('ensure-dir', async (event, dir) => {
        if (dir && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        return { success: true }
    })

    ipcMain.handle('select-image-file', async () => {
        const result = await dialog.showOpenDialog({
            title: '选择图片',
            filters: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
            properties: ['openFile']
        })
        if (result.canceled || result.filePaths.length === 0) return { success: false }
        const filePath = result.filePaths[0]
        const data = fs.readFileSync(filePath, { encoding: 'base64' })
        const ext = parse(filePath).ext.toLowerCase()
        const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' }
        const mime = mimeMap[ext] || 'image/png'
        return { success: true, data: `data:${mime};base64,${data}`, name: parse(filePath).base }
    })

    const DOCUMENT_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'md', 'csv', 'rtf', 'odt', 'ods', 'odp']

    ipcMain.handle('select-document-file', async () => {
        const docPath = join(app.getPath('documents'))
        const result = await dialog.showOpenDialog({
            title: '选择文档',
            defaultPath: fs.existsSync(docPath) ? docPath : app.getPath('home'),
            filters: [{ name: '文档文件', extensions: DOCUMENT_EXTENSIONS }],
            properties: ['openFile']
        })
        if (result.canceled || result.filePaths.length === 0) return { success: false }
        const filePath = result.filePaths[0]
        const data = fs.readFileSync(filePath, { encoding: 'base64' })
        const name = parse(filePath).base
        const ext = parse(filePath).ext.toLowerCase()
        return { success: true, data, name, ext }
    })
}

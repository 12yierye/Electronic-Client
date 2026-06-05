import { app, ipcMain, dialog } from 'electron'
import { join, parse } from 'node:path'
import axios from 'axios'
import fs from 'fs'
import crypto from 'crypto'
import { getAPIBase, getLanServerUrl, getDownloadDir, setDownloadDir } from '../config.js'

const CHUNK_SIZE = 2 * 1024 * 1024

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

function resolveBaseUrl(serverOrigin) {
    return serverOrigin === 'lan' ? getLanServerUrl() : getAPIBase()
}

export function registerFileIpc() {
    ipcMain.handle('download-file', async (event, username, filename, serverOrigin = 'public') => {
        const baseUrl = resolveBaseUrl(serverOrigin)
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
                url: `${baseUrl}/user/download/${encodeURIComponent(username)}/${encodeURIComponent(filename)}`,
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

    ipcMain.handle('upload-file', async (event, username, filename, fileData, serverOrigin = 'public') => {
        const baseUrl = resolveBaseUrl(serverOrigin)
        try {
            const response = await axios.post(`${baseUrl}/user/upload?username=${encodeURIComponent(username)}&filename=${encodeURIComponent(filename)}`, fileData, { headers: { 'Content-Type': 'application/octet-stream' } })
            return response.data
        } catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('delete-file', async (event, username, filename, serverOrigin = 'public') => {
        const baseUrl = resolveBaseUrl(serverOrigin)
        try {
            const response = await axios.delete(`${baseUrl}/user/file/${encodeURIComponent(username)}/${encodeURIComponent(filename)}`)
            return response.data
        } catch (error) { return { success: false, message: error.message } }
    })

    ipcMain.handle('get-user-files', async (event, username, serverOrigin = 'public') => {
        const baseUrl = resolveBaseUrl(serverOrigin)
        try {
            const response = await axios.get(`${baseUrl}/user/files?username=${encodeURIComponent(username)}`)
            return response.data
        } catch (error) {
            console.error('[GetUserFiles] err:', error.message)
            return { success: false, message: error.message }
        }
    })

    ipcMain.handle('get-all-files', async (serverOrigin = 'public') => {
        const baseUrl = resolveBaseUrl(serverOrigin)
        try {
            const response = await axios.get(`${baseUrl}/files/all`)
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

    ipcMain.handle('file:uploadChunked', async (event, { filePath, fileName, fileSize, fileData, serverOrigin = 'public' }) => {
        const baseUrl = resolveBaseUrl(serverOrigin)
        try {
            let fileBuffer
            if (filePath) {
                fileBuffer = fs.readFileSync(filePath)
            } else if (fileData) {
                fileBuffer = Buffer.from(fileData)
            } else {
                return { success: false, message: '未提供文件数据' }
            }

            const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex')
            const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE)

            const uploadedRes = await axios.get(`${baseUrl}/api/file/chunks?md5=${md5}`)
            const uploadedIndexes = uploadedRes.data?.chunks || []

            for (let i = 0; i < totalChunks; i++) {
                if (uploadedIndexes.includes(i)) {
                    try {
                        event.sender.send('file:uploadProgress', { fileName, progress: Math.round(((i + 1) / totalChunks) * 100) })
                    } catch (_) {}
                    continue
                }

                const chunk = fileBuffer.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
                const chunkData = Buffer.from(chunk).toString('base64')

                await axios.post(`${baseUrl}/api/file/chunk`, {
                    md5, index: i, totalChunks, fileName, chunk: chunkData
                })

                try {
                    event.sender.send('file:uploadProgress', { fileName, progress: Math.round(((i + 1) / totalChunks) * 100) })
                } catch (_) {}
            }

            await axios.post(`${baseUrl}/api/file/merge`, { md5, fileName, totalChunks })
            return { success: true, md5 }
        } catch (error) {
            return { success: false, message: error.message }
        }
    })

    ipcMain.handle('file:downloadVerified', async (event, { fileId, fileName, expectedMd5, serverOrigin = 'public' }) => {
        const baseUrl = resolveBaseUrl(serverOrigin)
        const downloadsDir = getDownloadDir()
        const tempPath = join(downloadsDir, fileName + '.part')
        const finalPath = join(downloadsDir, fileName)
        const MAX_RETRIES = 3

        try {
            if (!fs.existsSync(downloadsDir)) {
                fs.mkdirSync(downloadsDir, { recursive: true })
            }

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                const response = await axios({
                    method: 'GET',
                    url: `${baseUrl}/api/file/download/${encodeURIComponent(fileId || fileName)}`,
                    responseType: 'arraybuffer',
                    onDownloadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        try {
                            event.sender.send('download-progress', { filename: fileName, percentCompleted })
                        } catch (_) {}
                    }
                })

                const downloadedBuf = Buffer.from(response.data)
                const downloadedMD5 = crypto.createHash('md5').update(downloadedBuf).digest('hex')
                const serverMd5 = expectedMd5

                if (serverMd5 && downloadedMD5 !== serverMd5) {
                    if (attempt < MAX_RETRIES) {
                        try {
                            event.sender.send('file:downloadRetry', { fileName, attempt, maxRetries: MAX_RETRIES })
                        } catch (_) {}
                        continue
                    }
                    return { success: false, message: `文件校验失败（已重试${MAX_RETRIES}次）` }
                }

                fs.writeFileSync(finalPath, downloadedBuf)

                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)

                return { success: true, path: finalPath, message: `文件下载成功：${fileName}` }
            }
        } catch (error) {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
            return { success: false, message: error.message }
        }
    })
}

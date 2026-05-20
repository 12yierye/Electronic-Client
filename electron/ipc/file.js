import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import axios from 'axios'
import fs from 'fs'
import { API_BASE } from '../config.js'

export function registerFileIpc() {
  ipcMain.handle('download-file', async (event, username, filename) => {
    const downloadsDir = join(app.getPath('downloads'), 'Electronic')
    const tempFilename = filename + '.part'
    const finalPath = join(downloadsDir, filename)
    const tempPath = join(downloadsDir, tempFilename)

    try {
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true })
      }

      const response = await axios({
        method: 'GET',
        url: `${API_BASE}/user/download/${encodeURIComponent(filename)}`,
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          event.sender.send('download-progress', { filename, percentCompleted })
        }
      })

      const writer = fs.createWriteStream(tempPath)

      return new Promise((resolve, reject) => {
        response.data.pipe(writer)
        writer.on('finish', () => {
          fs.renameSync(tempPath, finalPath)
          resolve({ success: true, message: '文件下载成功' })
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
      const response = await axios.post(`${API_BASE}/user/upload?username=${username}&filename=${filename}`, fileData, { headers: { 'Content-Type': 'application/octet-stream' } })
      return response.data
    } catch (error) { return { success: false, message: error.message } }
  })

  ipcMain.handle('delete-file', async (event, username, filename) => {
    try {
      const response = await axios.delete(`${API_BASE}/user/file/${username}/${filename}`)
      return response.data
    } catch (error) { return { success: false, message: error.message } }
  })

  ipcMain.handle('get-user-files', async (event, username) => {
    try {
      const response = await axios.get(`${API_BASE}/user/files/${username}`)
      return response.data
    } catch (error) {
      console.error('[GetUserFiles] err:', error.message)
      return { success: false, message: error.message }
    }
  })
}

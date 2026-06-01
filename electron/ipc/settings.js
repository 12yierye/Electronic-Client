import { ipcMain } from 'electron'
import { setCloudAPIBase, setCloudAPIKey, setCloudModel, setCloudProvider, getCloudAPIBase, getCloudAPIKey, getCloudModel, getCloudProvider, setPPTDir, getPPTDir } from '../config.js'
import axios from 'axios'
import fs from 'fs'
import { join } from 'node:path'

export function registerSettingsIpc() {
  ipcMain.handle('set-cloud-api-base', async (event, url) => {
    setCloudAPIBase(url)
    return { success: true }
  })

  ipcMain.handle('set-cloud-api-key', async (event, key) => {
    setCloudAPIKey(key)
    return { success: true }
  })

  ipcMain.handle('set-cloud-model', async (event, model) => {
    setCloudModel(model)
    return { success: true }
  })

  ipcMain.handle('set-cloud-provider', async (event, provider) => {
    setCloudProvider(provider)
    return { success: true }
  })

  ipcMain.handle('get-cloud-config', async () => {
    return {
      success: true,
      base: getCloudAPIBase(),
      hasKey: !!getCloudAPIKey(),
      model: getCloudModel(),
      provider: getCloudProvider()
    }
  })

  ipcMain.handle('set-ppt-dir', async (event, dir) => {
    setPPTDir(dir)
    return { success: true }
  })

  ipcMain.handle('get-ppt-dir', async () => {
    return { success: true, dir: getPPTDir() }
  })

  ipcMain.handle('scan-directory', async (event, dir) => {
    try {
      const results = []
      if (dir && fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir)
        for (const entry of entries) {
          if (entry.endsWith('.meta.json')) {
            try {
              const meta = JSON.parse(fs.readFileSync(join(dir, entry), 'utf-8'))
              const baseName = entry.replace('.meta.json', '')
              const pptxPath = entries.find(e => e === baseName + '.pptx') ? join(dir, baseName + '.pptx') : null
              results.push({
                topic: meta.topic || baseName,
                slideCount: meta.slideCount || 0,
                type: meta.type || 'pptx',
                pptxSize: meta.pptxSize || 0,
                handoutPath: meta.handoutPath || null,
                createdAt: meta.createdAt,
                pptxPath,
                metaPath: join(dir, entry)
              })
            } catch {}
          }
        }
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      }
      return { success: true, files: results }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('test-cloud-api', async (event, { base, key, model }) => {
    try {
      const pingRes = await axios.get(`${base}/models`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        timeout: 8000
      }).catch(() => null)

      const chatRes = await axios.post(`${base}/chat/completions`, {
        model,
        messages: [{ role: 'user', content: 'say the word CONFIRMED and nothing else' }],
        max_tokens: 20,
        temperature: 0
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: key ? `Bearer ${key}` : ''
        },
        timeout: 30000
      })

      const content = chatRes.data?.choices?.[0]?.message?.content || ''
      if (/confirm/i.test(content)) {
        return { success: true, message: `连接成功！模型 "${model}" 响应正常。` }
      }
      return { success: true, message: `可连接，模型返回：${content.slice(0, 80)}` }
    } catch (error) {
      const status = error.response?.status
      const msg = error.response?.data?.error?.message || error.message
      return { success: false, message: `[${status || 'ERR'}] ${msg}` }
    }
  })
}

import { ipcMain } from 'electron'
import { setCloudAPIBase, setCloudAPIKey, setCloudModel, setCloudProvider, getCloudAPIBase, getCloudAPIKey, getCloudModel, getCloudProvider, setPPTDir, getPPTDir, setProviderConfig, getProviderConfig, getAllProviderConfigs, setUseSystemBrowser, getUseSystemBrowser, setImageGenConfig, getImageGenConfig, setImageGenPriority, getImageGenPriority, setImageGenSubPriority, getImageGenSubPriority, setImageGenServerIP, getImageGenServerIP, setImageGenServerPort, getImageGenServerPort, getImageGenServerURL } from '../config.js'
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
              if (meta.debug) continue
              const baseName = entry.replace('.meta.json', '')
              const pptxPath = entries.find(e => e === baseName + '.pptx') ? join(dir, baseName + '.pptx') : null
              results.push({
                topic: meta.topic || baseName,
                slideCount: meta.slideCount || 0,
                type: meta.type || 'pptx',
                pptxSize: meta.pptxSize || 0,
                handoutPath: meta.handoutPath || null,
                createdAt: meta.createdAt,
                thumbnail: meta.thumbnail || null,
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

  ipcMain.handle('delete-ppt-file', async (event, { pptxPath, metaPath }) => {
    try {
      if (pptxPath && fs.existsSync(pptxPath)) fs.unlinkSync(pptxPath)
      if (metaPath && fs.existsSync(metaPath)) fs.unlinkSync(metaPath)
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('scan-debug-directory', async (event, dir) => {
    try {
      const results = []
      if (dir && fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir)
        for (const entry of entries) {
          if (entry.endsWith('.meta.json')) {
            try {
              const meta = JSON.parse(fs.readFileSync(join(dir, entry), 'utf-8'))
              if (!meta.debug) continue
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

  ipcMain.handle('set-image-provider-config', async (event, config) => {
    setProviderConfig(config)
    return { success: true }
  })

  ipcMain.handle('get-image-provider-config', async () => {
    return { success: true, config: getAllProviderConfigs() }
  })

  ipcMain.handle('set-use-system-browser', async (event, val) => {
    setUseSystemBrowser(val)
    return { success: true }
  })

  ipcMain.handle('get-use-system-browser', async () => {
    return { success: true, value: getUseSystemBrowser() }
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

  ipcMain.handle('set-image-gen-config', async (event, config) => {
    setImageGenConfig(config)
    return { success: true }
  })
  ipcMain.handle('get-image-gen-config', async () => {
    return { success: true, config: getImageGenConfig() }
  })
  ipcMain.handle('set-image-gen-priority', async (event, val) => {
    setImageGenPriority(val)
    return { success: true }
  })
  ipcMain.handle('get-image-gen-priority', async () => {
    return { success: true, value: getImageGenPriority() }
  })
  ipcMain.handle('set-image-gen-sub-priority', async (event, val) => {
    setImageGenSubPriority(val)
    return { success: true }
  })
  ipcMain.handle('get-image-gen-sub-priority', async () => {
    return { success: true, value: getImageGenSubPriority() }
  })
  ipcMain.handle('set-image-gen-server', async (event, { ip, port }) => {
    if (ip) setImageGenServerIP(ip)
    if (port) setImageGenServerPort(port)
    return { success: true, serverURL: getImageGenServerURL() }
  })
  ipcMain.handle('get-image-gen-server', async () => {
    return { success: true, ip: getImageGenServerIP(), port: getImageGenServerPort(), serverURL: getImageGenServerURL() }
  })
  ipcMain.handle('test-image-gen', async (event, { prompt }) => {
    try {
      const { generateImage } = await import('../services/imageGen.js')
      const buf = await generateImage(prompt || 'a cute cat sitting on a desk')
      if (buf) {
        const b64 = buf.toString('base64')
        return { success: true, data: `data:image/png;base64,${b64}` }
      }
      return { success: false, message: '生成失败，请检查 API Key 和配置' }
    } catch (e) {
      return { success: false, message: e.message }
    }
  })
}

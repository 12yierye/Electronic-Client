import pkg from 'electron-updater'
const { autoUpdater } = pkg
import fs from 'node:fs'
import { join } from 'node:path'
import { app, shell, net } from 'electron'
import { getMainWindow } from '../config.js'

const REPO = '12yierye/Electronic-Client'
const RELEASE_PAGE = `https://github.com/${REPO}/releases/latest`
const CACHE_TTL = 10 * 60 * 1000
const API_TIMEOUT = 10 * 1000
const MAX_ATTEMPTS = 3
const RETRY_DELAY = 1500

// 关闭自动下载，让用户点击后再下载
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let isSilentCheck = false
let checking = false
let lastAutoUpdateInfo = null
let lastRelease = null

function sendToRenderer(channel, data) {
    const mw = getMainWindow()
    if (mw && !mw.isDestroyed()) {
        mw.webContents.send(channel, data)
    }
}

function cachePath() {
    return join(app.getPath('userData'), 'update-check.json')
}

function prefsPath() {
    return join(app.getPath('userData'), 'update-prefs.json')
}

// 自动检查默认关闭，仅在设置中手动开启后生效
export function isAutoCheckEnabled() {
    try {
        const prefs = JSON.parse(fs.readFileSync(prefsPath(), 'utf-8'))
        return prefs?.autoCheck === true
    } catch {
        return false
    }
}

export function setAutoCheckEnabled(enabled) {
    try {
        fs.writeFileSync(prefsPath(), JSON.stringify({ autoCheck: !!enabled }))
    } catch (error) {
        console.warn('[AutoUpdater] 保存自动检查设置失败:', error.message)
    }
    return !!enabled
}

function readCache() {
    try {
        return JSON.parse(fs.readFileSync(cachePath(), 'utf-8'))
    } catch {
        return null
    }
}

function writeCache(data) {
    try {
        fs.writeFileSync(cachePath(), JSON.stringify(data))
    } catch {}
}

function normalizeVersion(version) {
    return String(version || '').trim().replace(/^v/i, '')
}

function compareVersions(a, b) {
    const left = normalizeVersion(a).split('.').map(n => parseInt(n, 10) || 0)
    const right = normalizeVersion(b).split('.').map(n => parseInt(n, 10) || 0)
    const length = Math.max(left.length, right.length)
    for (let i = 0; i < length; i++) {
        const x = left[i] || 0
        const y = right[i] || 0
        if (x !== y) return x > y ? 1 : -1
    }
    return 0
}

function describeError(error) {
    const status = error?.status || error?.response?.status
    if (status === 404) return '仓库暂无发布版本'
    if (status === 403 || status === 429) return 'GitHub 接口访问受限，请稍后重试'
    const code = error?.code
    if (code === 'ENOTFOUND' || code === 'ERR_NAME_NOT_RESOLVED' || code === 'EAI_AGAIN') {
        return '无法解析 GitHub 域名，请检查网络或代理'
    }
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'ERR_CONNECTION_TIMED_OUT') {
        return '连接 GitHub 超时，请检查网络或代理'
    }
    if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ERR_CONNECTION_RESET' || code === 'ERR_CONNECTION_REFUSED') {
        return '连接 GitHub 失败，请检查网络或代理'
    }
    if (String(code || '').startsWith('ERR_CERT')) {
        return '证书校验失败，请检查安全软件或代理的 HTTPS 拦截'
    }
    if (code === 'ERR_INTERNET_DISCONNECTED' || code === 'ERR_NETWORK_CHANGED') {
        return '网络未连接，请检查网络'
    }
    return error?.message || '检查更新失败'
}

// 走 Electron 的网络栈，复用系统证书库与系统代理，避免 Node CA 校验失败
function requestJson(url) {
    return new Promise((resolve, reject) => {
        const request = net.request({ method: 'GET', url, redirect: 'follow' })

        let settled = false
        const finish = (fn, value) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            fn(value)
        }

        const timer = setTimeout(() => {
            request.abort()
            finish(reject, Object.assign(new Error('连接 GitHub 超时'), { code: 'ETIMEDOUT' }))
        }, API_TIMEOUT)

        request.setHeader('User-Agent', 'Electronic-Client')
        request.setHeader('Accept', 'application/vnd.github+json')
        const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
        if (token) request.setHeader('Authorization', `Bearer ${token}`)

        request.on('response', (response) => {
            let body = ''
            response.on('data', (chunk) => { body += chunk.toString() })
            response.on('error', (error) => finish(reject, error))
            response.on('end', () => {
                const status = response.statusCode
                if (status < 200 || status >= 300) {
                    return finish(reject, Object.assign(new Error(`HTTP ${status}`), { status }))
                }
                try {
                    finish(resolve, JSON.parse(body))
                } catch {
                    finish(reject, new Error('GitHub 返回数据解析失败'))
                }
            })
        })
        request.on('error', (error) => finish(reject, error))
        request.end()
    })
}

// 直接查 GitHub Releases，开发模式也能用，不受 app-update.yml 限制
async function fetchLatestRelease(force = false) {
    const cache = readCache()
    if (!force && cache?.release && Date.now() - (cache.checkedAt || 0) < CACHE_TTL) {
        return cache.release
    }

    let lastError = null
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const data = await requestJson(`https://api.github.com/repos/${REPO}/releases/latest`)
            const release = {
                version: normalizeVersion(data?.tag_name || data?.name || ''),
                url: data?.html_url || RELEASE_PAGE,
                notes: data?.body || '',
                publishedAt: data?.published_at || ''
            }
            if (!release.version) throw new Error('发布信息缺少版本号')

            writeCache({ checkedAt: Date.now(), release })
            return release
        } catch (error) {
            lastError = error
            console.warn(`[AutoUpdater] 获取发布信息失败（${attempt}/${MAX_ATTEMPTS}）:`, describeError(error))
            if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        }
    }
    throw lastError
}

autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version)
    lastAutoUpdateInfo = info
    sendToRenderer('update:status', {
        status: 'update-available',
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
    })
    isSilentCheck = false
})

autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Update not available, current:', info.version)
    sendToRenderer('update:status', {
        status: 'update-not-available',
        version: info.version
    })
    isSilentCheck = false
})

autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent)
    const speed = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(1)
    const transferred = (progressObj.transferred / 1024 / 1024).toFixed(1)
    const total = (progressObj.total / 1024 / 1024).toFixed(1)
    console.log(`[AutoUpdater] Downloading... ${percent}% (${transferred}MB / ${total}MB @ ${speed}MB/s)`)
    sendToRenderer('update:progress', {
        percent,
        speed: parseFloat(speed),
        transferred: parseFloat(transferred),
        total: parseFloat(total),
        bytesPerSecond: progressObj.bytesPerSecond
    })
})

autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version)
    sendToRenderer('update:status', {
        status: 'update-downloaded',
        version: info.version
    })
})

autoUpdater.on('error', (err) => {
    const message = describeError(err)
    console.error('[AutoUpdater] Error:', message)
    if (!isSilentCheck) {
        sendToRenderer('update:status', {
            status: 'error',
            message
        })
    }
    isSilentCheck = false
})

/**
 * 检查更新：先用 GitHub API 判断版本，打包环境再交给 electron-updater 接管下载
 */
export async function checkForUpdates(silent = false, force = false) {
    if (checking) return { success: false, message: '正在检查中' }
    checking = true
    isSilentCheck = true

    const currentVersion = app.getVersion()
    if (!silent) {
        sendToRenderer('update:status', { status: 'checking' })
    }

    let release = null
    let apiError = null
    try {
        release = await fetchLatestRelease(force)
    } catch (error) {
        apiError = error
    }

    if (release) {
        lastRelease = release
        if (compareVersions(release.version, currentVersion) > 0) {
            sendToRenderer('update:status', {
                status: 'update-available',
                version: release.version,
                releaseNotes: release.notes,
                releaseUrl: release.url,
                manual: !app.isPackaged
            })
            if (app.isPackaged) {
                try {
                    await autoUpdater.checkForUpdates()
                } catch (error) {
                    console.warn('[AutoUpdater] electron-updater check failed:', describeError(error))
                }
            }
        } else {
            sendToRenderer('update:status', {
                status: 'update-not-available',
                version: currentVersion
            })
        }
        checking = false
        isSilentCheck = false
        return { success: true, version: release.version }
    }

    // API 不可用时，打包环境退回 electron-updater 再试一次
    if (app.isPackaged) {
        try {
            const result = await autoUpdater.checkForUpdates()
            if (result) {
                checking = false
                return { success: true }
            }
        } catch (error) {
            apiError = apiError || error
        }
    }

    const message = apiError ? describeError(apiError) : '检查更新失败'
    // 连续失败 3 次后不向界面推送任何提示，仅记录日志
    console.warn('[AutoUpdater] 检查更新失败，已静默处理:', message)
    checking = false
    isSilentCheck = false
    return { success: false, message }
}

/**
 * 下载更新：开发模式或缺少更新元数据时打开 Release 页面
 */
export function downloadUpdate() {
    if (!app.isPackaged || !lastAutoUpdateInfo) {
        shell.openExternal(lastRelease?.url || RELEASE_PAGE)
        sendToRenderer('update:status', {
            status: 'manual-download',
            version: lastRelease?.version || app.getVersion(),
            message: '已打开下载页面'
        })
        return
    }

    sendToRenderer('update:status', { status: 'downloading' })
    autoUpdater.downloadUpdate().catch((err) => {
        console.error('[AutoUpdater] downloadUpdate failed:', describeError(err))
        sendToRenderer('update:status', {
            status: 'error',
            message: describeError(err)
        })
    })
}

/**
 * 安装更新并重启应用
 */
export function installUpdate() {
    if (!app.isPackaged) {
        shell.openExternal(RELEASE_PAGE)
        return
    }
    autoUpdater.quitAndInstall(false, true)
}

const DEFAULT_PORT = '3001'

function readJson(key) {
    try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

// 公网主服务端地址：优先用户配置的公网地址，其次内网配置，最后本机默认端口
export function getServerBaseUrl() {
    const primary = readJson('primaryServer')
    if (primary?.url) return primary.url.replace(/\/+$/, '')

    const lan = readJson('lanChatSettings')
    if (lan?.serverIP) return `http://${lan.serverIP}:${lan.serverPort || DEFAULT_PORT}`

    return `http://127.0.0.1:${DEFAULT_PORT}`
}

// 内网服务端地址，未配置时返回空
export function getLanBaseUrl() {
    const lan = readJson('lanChatSettings')
    if (lan?.serverIP) return `http://${lan.serverIP}:${lan.serverPort || DEFAULT_PORT}`
    return ''
}

export { DEFAULT_PORT }

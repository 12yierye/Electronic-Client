export function getAuthToken() {
    try {
        return localStorage.getItem('authToken') || ''
    } catch {
        return ''
    }
}

export function apiFetch(url, options = {}) {
    const token = getAuthToken()
    const headers = { ...(options.headers || {}) }
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(url, { ...options, headers })
}

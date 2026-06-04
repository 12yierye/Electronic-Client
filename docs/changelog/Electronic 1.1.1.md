# Electronic 1.1.1

> 个人 AI 助手 · 即时通讯 · 桌面应用

---

## 关于此版本

### 该版本修复了服务端连接相关的问题

---

## Bug 修复

- 修复了在「设置 — 服务器」页面修改服务器地址后未同步到主进程，导致登录请求发送到错误地址的问题
- 修复了首次启动或 localStorage 为空时主进程无法获取服务器地址的问题
- 修复了 `syncServerSettingsToMain` 在空 localStorage 时提前返回，未将默认地址同步到主进程的问题

---

## 优化

- `Settings.vue` 的 `saveServerSettings` 现为 async 函数，保存服务器地址后自动通过 IPC 同步到主进程
- `syncServerSettingsToMain` 在 localStorage 为空时回退到当前显示的 `apiBase` 值，确保主进程始终有正确的地址

---

> 产物输出: `release/Electronic 1.1.1.exe`

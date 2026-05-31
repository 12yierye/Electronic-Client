# Electronic Phase 1 — 稳固基座 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 Electronic 从原型升级为校园级可靠通讯平台——补齐组织架构、广播通知、文件传输、消息持久化、内网隐私、微信式体验六大短板

**Architecture:** Electron 主进程负责 IPC + 文件操作 + WebSocket，Vue3 渲染进程负责 UI，Pinia 管理状态。后端 Server 提供 REST API + Socket.IO 实时通道。

**Tech Stack:** Electron 28, Vue 3 + Composition API, Element Plus, Pinia, WebSocket, Node.js crypto, SparkMD5

---

## 实施状态：✅ 全部完成 (2025-05-31)

### 模块一：组织架构管理 ✅
- `electron/ipc/org.js` — IPC 处理器（getTree, addNode, removeNode, manageMembers）
- `electron/index.js` — 注册 org IPC
- `electron/preload.cjs` — 暴露 org API
- `src/stores/org.js` — Pinia 组织架构 Store
- `src/components/common/OrgTree.vue` — 组织架构树 UI 组件
- `src/components/views/ChatRoom.vue` — 集成 org 标签页
- `src/utils/i18n.js` — 三语翻译 (zh-CN/en/ja)
- `src/utils/mockApi.js` — 浏览器开发桩

### 模块二：消息广播系统 ✅
- `electron/ipc/broadcast.js` — IPC 处理器（send, list, receipts, markRead）
- `electron/index.js` — 注册 broadcast IPC
- `electron/preload.cjs` — 暴露 broadcast API
- `src/components/views/BroadcastCenter.vue` — 广播中心组件（发送+列表+已读回执）
- `src/App.vue` — 注册视图路由
- `src/components/layout/AppNavigation.vue` — 添加广播导航按钮
- `src/utils/i18n.js` — 三语翻译

### 模块三：文件传输增强 ✅
- `electron/ipc/file.js` — 分片上传 (`file:uploadChunked`) + MD5 校验下载 (`file:downloadVerified`) 带自动重试
- `electron/preload.cjs` — 暴露增强文件操作 + 进度/重试事件监听
- `src/components/views/FileManager.vue` — 上传/下载进度条、重试状态 UI
- `src/utils/mockApi.js` — 浏览器开发桩

### 模块四：离线消息队列 ✅
- `electron/services/websocket.js` — 离线消息队列（本地持久化 + 重连自动发送）
- `src/composables/messageCache.js` — 消息发送状态追踪 (sending/sent/delivered/read/failed)

### 模块五：微信式聊天体验 ✅
- `src/components/views/ChatRoom.vue` — 消息气泡重设计（WeChat 绿色气泡）、时间分隔线、引用回复、消息发送状态（✓/✓✓/失败重发）
- 引用回复预览条 + 右键引用
- `src/utils/i18n.js` — 新增 i18n 键

### 模块六：端到端加密层 ✅
- `electron/services/crypto.js` — AES-256-GCM 加密/解密 + ECDH 密钥交换
- `src/components/views/Settings.vue` — 隐私加密设置面板（关闭/仅内网/全部）

### 模块七：国际化 ✅
- 所有新增 UI 均已添加 zh-CN / English / 日本語 翻译

---

## 构建验证

```
vite build --mode electron → ✅ 0 errors
  1725 modules transformed
  dist-electron/index.js  41.24 kB
  dist-electron/preload.js 6.05 kB
  dist/assets/index.js    741.17 kB
```

## 后端 API 待实现

以下 API 端点需要在后端 Server 中实现（不在本仓库）：

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/org/tree` | GET | 获取组织架构树 |
| `/api/org/node` | POST | 添加节点 |
| `/api/org/node/:id` | DELETE | 删除节点 |
| `/api/org/node/:id/members` | PUT | 管理节点成员 |
| `/api/broadcast/send` | POST | 发送广播 |
| `/api/broadcast/list` | GET | 获取广播列表 |
| `/api/broadcast/receipts/:id` | GET | 获取已读回执 |
| `/api/broadcast/read/:id` | POST | 标记已读 |
| `/api/file/chunks` | GET | 查询已上传分片 |
| `/api/file/chunk` | POST | 接收分片 |
| `/api/file/merge` | POST | 合并分片 |

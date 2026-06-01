# Electronic 开发路线图

> 校园级 AI 通讯与内容创作平台 — 三阶段演进

---

## Phase 1：稳固基座 ✅ 已完成

**目标**：从原型升级为校园级可靠通讯平台

### 已完成

| 模块 | 说明 | 关键文件 |
|------|------|----------|
| 组织架构管理 | 学校→年级→班级 树形结构，成员管理 | `electron/ipc/org.js`, `OrgTree.vue`, `stores/org.js` |
| 广播通知系统 | 全校/年级/班级广播 + 已读回执 | `electron/ipc/broadcast.js`, `BroadcastCenter.vue` |
| 文件传输增强 | 分片上传 + MD5 校验 + 断点续传 + 自动重试 | `electron/ipc/file.js`, `FileManager.vue` |
| 离线消息队列 | WebSocket 断开本地排队 + 重连自动发送 | `electron/services/websocket.js`, `messageCache.js` |
| 微信式聊天体验 | 绿色气泡 + 时间分隔 + 引用回复 + 发送状态 ✓✓ | `ChatRoom.vue` |
| E2E 加密层 | AES-256-GCM 端到端加密 | `electron/services/crypto.js`, `Settings.vue` |
| 角色权限体系 | 6 角色可配置权限 + Manager 管理端改造 | `roles_config.json`, `server.js`, `accounts.js/html/css` |
| 三语国际化 | zh-CN / English / 日本語 | `src/utils/i18n.js` |

### 后端新增 API

| 端点 | 用途 |
|------|------|
| `/api/org/*` | 组织架构 CRUD + 成员管理 |
| `/api/broadcast/*` | 广播发送/列表/已读 |
| `/api/file/chunk|merge` | 分片文件上传 |
| `/api/accounts/roles` | 角色配置列表 |
| `PUT /api/accounts/:username` | 编辑账户 |

---

## Phase 2：AI Agent 引擎 ✅ 已完成

**目标**：一句话调度多工具，模型路由器（本地+云端）

### 已完成

| 模块 | 说明 | 关键文件 |
|------|------|----------|
| 云端 API 集成 | 5 厂商模板（DeepSeek/OpenAI/Qwen/智谱/Moonshot）+ 自定义 | `cloudProviders.js`, `Settings.vue` |
| 模型路由器 | 本地/云端智能切换 + 自动降级 | `electron/services/modelRouter.js` |
| Tool Registry | 12 个插拔式工具（消息/广播/文件/组织/PPT/系统） | `electron/services/toolRegistry.js` |
| Agent Engine | 多步骤编排循环 + streaming 流式输出 | `electron/services/agentEngine.js` |
| PPT 课件生成 | AI 设计结构 → pptxgenjs 渲染 → .pptx | `electron/services/pptxGenerator.js` |
| 对话历史 | 上下文注入（自动裁剪 + token 估算） | `stores/ai.js → getConversationHistory()` |
| 云端模式切换 | AIChat 头栏切换 本地/云端 + 云模型选择 | `AIChat.vue` |
| API 测试按钮 | Settings 中一键验证云端 API 可用性 | `electron/ipc/settings.js`, `Settings.vue` |
| 上下文长度 | 滑块调节 1K~1M，模型上限自适应 | `stores/ai.js`, `cloudProviders.js` |
| 打断/取消 | AbortController 真正截断 LLM 输出 | `agentEngine.js`, `agent.js` |
| 历史对话管理 | 多对话切换 + 重命名 + 删除 | `stores/ai.js`, `AIChat.vue` |
| 对话持久化 | localStorage 自动保存/恢复 | `stores/ai.js` |

### 未完成

| 项目 | 说明 |
|------|------|
| ~~思考流式输出~~ | ✅ 已完成（streaming content chunks） |
| ~~内容不消失~~ | ✅ 已完成（localStorage 持久化） |
| ~~对话上下文~~ | ✅ 已完成（getConversationHistory） |
| 追问规划模式 | AI 先提问澄清再执行（Phase 2 规划但推迟到后续） |

---

## Phase 3：内容工坊 🔄 进行中

**目标**：完整智能内容创作系统

### 进行中

| 模块 | 说明 | 文件 |
|------|------|------|
| 增强 PPTX (图表/表格/对比) | 柱状图/饼图/折线图 + 数据表格 + 对比页 | `pptxGenerator.js` |
| 多轮修改对话 | 保存 meta.json + edit_pptx Tool | `toolRegistry.js`, `pptxGenerator.js` |
| .docx 讲义生成 | docx 库生成配套讲义 | `handoutGenerator.js` (新建) |
| 完整教案包 | PPTX + docx + 练习题 + 大纲 | `toolRegistry.js` |
| 模板系统 | 保存/命名/切换排版模板 | `templateManager.js` (新建) |
| 内容库 | 浏览/搜索/编辑历史课件 | `ContentLibrary.vue` (新建) |

### 未开始

| 项目 | 说明 |
|------|------|
| 图片插入 PPTX | AI 搜索并嵌入相关图片 |
| LaTeX 公式支持 | 数学课件公式渲染 |
| 远程模板库 | 云端共享模板 |
| PPTX 导入 | 基于现有 PPTX 修改 |

---

## 系统架构总览

```
┌─────────────────────────────────────────────────────┐
│                   Electron 壳                        │
│  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐ │
│  │ AIChat  │ │ChatRoom│ │Broadcast │ │ContentLib │ │
│  │ (Vue3)  │ │ (Vue3) │ │ (Vue3)   │ │ (Vue3)    │ │
│  └────┬────┘ └───┬────┘ └────┬─────┘ └─────┬─────┘ │
│       └───────────┼───────────┼─────────────┘       │
│            ┌──────┴──────┐ ┌──┴──────────┐          │
│            │ Agent 引擎   │ │ E2E Crypto  │          │
│            │ (Tool Loop)  │ │ (AES-GCM)   │          │
│            └──────┬──────┘ └─────────────┘          │
│      ┌────────────┼─────────────┐                    │
│  ┌───┴───┐  ┌────┴────┐  ┌────┴────┐               │
│  │本地LLM│  │云端 API │  │PPTX引擎 │               │
│  │LMStudio│ │DeepSeek │  │pptxgenjs│               │
│  └───────┘  └─────────┘  └─────────┘               │
│                                                    │
│  ┌──────────┐  ┌──────────────────┐                 │
│  │ 公网通道  │  │  内网 LAN P2P    │                 │
│  │(加密隧道) │  │  (零外网依赖)    │                 │
│  └──────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

---

## 构建验证

```
vite build --mode electron → 1725+ modules → 0 errors
  dist/index.html         3.11 kB
  dist/assets/index.css   252 kB
  dist/assets/index.js    793 kB
  dist-electron/index.js  70 kB
  dist-electron/preload.js 7 kB
```

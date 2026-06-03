# Electronic 开发路线图

> 校园级 AI 通讯与内容创作平台 — 六阶段演进

---

## Phase 1：稳固基座 ✅ 已完成

**目标**：从原型升级为校园级可靠通讯平台

| 模块 | 关键文件 |
|------|----------|
| 组织架构管理（学校→班级树） | `OrgTree.vue`, `stores/org.js` |
| 广播通知系统 + 已读回执 | `BroadcastCenter.vue` |
| 分片文件上传 + MD5 校验 | `electron/ipc/file.js` |
| 离线消息队列 | `electron/services/websocket.js` |
| 微信式聊天体验（气泡/引用/✓✓） | `ChatRoom.vue` |
| E2E 加密（AES-256-GCM） | `electron/services/crypto.js` |
| 角色权限体系（6 角色可配置） | `roles_config.json`, Manager 改造 |
| 三语国际化 | `src/utils/i18n.js` |

---

## Phase 2：AI Agent 引擎 ✅ 已完成

**目标**：一句话调度多工具，本地+云端双模

| 模块 | 关键文件 |
|------|----------|
| 云端 API（5 厂商模板） | `cloudProviders.js`, `Settings.vue` |
| 模型路由器 | `electron/services/modelRouter.js` |
| 12 Tool 注册表 | `electron/services/toolRegistry.js` |
| Agent 流式编排引擎 | `electron/services/agentEngine.js` |
| 对话上下文管理 | `stores/ai.js` |
| 打断/取消（AbortController） | `agentEngine.js`, `agent.js` |
| 历史对话管理 | `stores/ai.js`, `AIChat.vue` |
| PPT/讲义生成（pptx+docx） | `pptxGenerator.js`, `handoutGenerator.js` |
| 思考过程可视化 | `AIChat.vue` thinking section |

---

## Phase 3：内容工坊 ✅ 已完成

**目标**：完整的智能内容创作系统

| 模块 | 关键文件 |
|------|----------|
| 图表/表格/对比 PPT 幻灯片 | `pptxGenerator.js` |
| 多轮编辑（meta.json 驱动） | `toolRegistry.js` → `edit_pptx` |
| .docx 讲义生成 | `handoutGenerator.js` |
| 模板系统（新建/切换） | `Settings.vue` |
| 内容库（浏览/打开/删除） | `ContentLibrary.vue` |
| PPT 生成进度动画 | `AIChat.vue` thinking label |

---

## Phase 4：追问规划模式 ✅ 已完成

**目标**：复杂任务先多选提问再执行

| 模块 | 关键文件 |
|------|----------|
| 规划专用 System Prompt + 8 轮追问 | `agentEngine.js` → `planningAgent()` |
| 多选卡片 UI（单选/多选/「其他」/「跳过」） | `AIChat.vue` question-block |
| 规划分块检测与转发 | `AIInputFooter.vue` |
| Store 层（bubble/choice/持久化） | `stores/ai.js` |
| IPC 层规划模式路由 | `ipc/agent.js`, `preload.cjs` |

📄 详细计划：[phase4-planning-mode.md](plans/phase4-planning-mode.md)

---

## Phase 5：课件深度增强 🔲 待开始

**目标**：图片、公式、过渡动画支持

- LLM 搜索并嵌入相关图片
- KaTeX 数学公式渲染
- 幻灯片过渡动画
- 多语言课件

📄 详细计划：[phase5-enhanced-courseware.md](plans/phase5-enhanced-courseware.md)

---

## 遗留问题清单

> 以下问题在 Phase 1-5 实施过程中发现，需在进入 Phase 6 前修复

| # | 问题 | 位置 | 阶段 | 优先级 |
|---|------|------|------|--------|
| 1 | **Agent 硬编码为中文** — 系统提示 `Always respond in Chinese`，不随用户语言切换 | `agentEngine.js:8` | P5 | 🔴 高 |
| 2 | **PLANNING_PROMPT 仅中文** — 多语言用户无法使用规划模式 | `agentEngine.js:36-56` | P5 | 🔴 高 |
| 3 | **Tool 描述仅中文** — 英文/日文用户无法理解工具功能 | `agentEngine.js:10-32` | P5 | 🟡 中 |
| 4 | **PPTX 回退幻灯片硬编码中文** — LLM 失败时显示「相关内容」 | `pptxGenerator.js:159-170` | P5 | 🟢 低 |
| 5 | **`getGreeting()` 缺日语** — 日语用户会看到英文问候 | `stores/ai.js:423-436` | P3 | 🟢 低 |
| 6 | **ContentLibrary 功能薄弱** — 无分页/预览/文件夹浏览 | `ContentLibrary.vue` | P3 | 🟡 中 |
| 7 | **主 JS 包过大** — 1083 kB（gzip 350 kB），可代码分割 | 构建输出 | P5 | 🟢 低 |
| 8 | **PPT 过渡效果未生效** — fade/push/wipe 设置后幻灯片无实际过渡；选择提问/回答/擦除会导致 PPT 取消生成 | `pptxGenerator.js` 过渡逻辑 + `agentEngine.js` 规划执行 | P5 | 🔴 高 |
| 9 | **DeepSeek V4 Flash 思考模式** — 支持思考(深度推理)与非思考模式，需驻留在工具栏随时切换，仅当切换到支持相同功能的模型时该按钮才可用 | 工具栏 + `modelRouter.js` | P5 | 🔴 高 |
| 10 | **聊天滑动跳底** — 与好友聊天滚动到顶端时瞬间跳回底部，无法查看历史消息 | 聊天组件滚动逻辑 | P2 | 🔴 高 |
| 11 | **顶部导航栏未读消息数** — 从未显示未读消息角标/数字 | 导航栏组件 | P2 | 🔴 高 |
| 12 | **用户状态系统** — 在线(无免打扰)/离线(仅接收离线消息)/忙碌(免打扰)，头像右下角颜色小点，侧边栏可调整自身状态，设置可控制是否查看他人状态 | 侧边栏 + 头像组件 + 设置 + WebSocket 状态同步 | P2 | 🟡 中 |
| 13 | **群聊头像设置** — 允许群组设置自定义头像 | 群聊设置 | P2 | 🟢 低 |
| 14 | **添加/删除好友** — 完整的双向好友管理功能 | 好友管理 + IPC + 数据库 | P2 | 🟡 中 |

---

## Phase 6：教学辅助工具 🔲 待开始

**目标**：完整教师工作台

- 作业批改（图片识别+评分）
- 智能试卷生成
- 学情分析图表
- 教学计划自动生成
- 家校通知模板

📄 详细计划：[phase6-teaching-tools.md](plans/phase6-teaching-tools.md)

---

## 构建状态

```
vite build --mode electron → 1741 modules → 0 errors
  dist/index.html             3.11 kB
  dist/assets/index.css       253 kB
  dist/assets/index-CZ5y8ms7.js  1083 kB (gzip 350 kB ⚠️)
  dist-electron/index.js      82 kB
  dist-electron/preload.js    7 kB
```

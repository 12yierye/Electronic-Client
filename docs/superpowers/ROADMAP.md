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

## Phase 4：追问规划模式 🔲 待开始

**目标**：复杂任务先多选提问再执行

- AI 多轮提问（最多 8 轮）→ 确认需求 → 执行
- 问题以多选卡片形式展示
- 触发词：课件|教案|通知|广播|群发

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
vite build --mode electron → 1740 modules → 0 errors
  dist/index.html             3.11 kB
  dist/assets/index.css       253 kB
  dist/assets/index.js        799 kB
  dist-electron/index.js      82 kB
  dist-electron/preload.js    7 kB
```

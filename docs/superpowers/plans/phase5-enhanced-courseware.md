# Phase 5 — 课件深度增强

> **目标：** 图片、公式、过渡动画支持 + Agent 多语言适配

---

## 当前状态

以下 Phase 5 技术特性 **已在代码中实现**，无需重复开发：

| 特性 | 状态 | 证据 |
|------|------|------|
| 5.1 图片插入 — `search_images` 工具 + 自动搜图嵌入 PPTX | ✅ 已完成 | `toolRegistry.js:176`, `pptxGenerator.js:211-370` |
| 5.2 LaTeX 公式 — KaTeX 渲染 `$...$` / `$$...$$` + PPTX 内 SVG | ✅ 已完成 | `katex@0.17.0`, `stores/ai.js:1-43`, `pptxGenerator.js:372-395` |
| 5.3 过渡动画 — fade/push/wipe 三种，LLM 自动选择 | ✅ 已完成 | `pptxGenerator.js:184-186` |
| 5.4 多语言课件 — `detectLanguage()` + `FONT_MAP`（zh-CN/en/ja） | ✅ 已完成 | `pptxGenerator.js:58-66` |

---

## 剩余工作

Phase 5 的真正剩余工作量集中在 **Agent 层的多语言适配** 和几个清理项上：

### 5.5 Agent 多语言适配

#### 问题
`agentEngine.js` 的所有系统提示、规划提示、工具描述均硬编码为中文，无法响应 UI 语言切换。

#### 改动文件

| 文件 | 改动 |
|------|------|
| `electron/services/agentEngine.js` | 系统提示词、PLANNING_PROMPT、工具描述改为语言参数化 |
| `src/utils/i18n.js` | 新增 `agent` 命名空间（systemPrompt, planningPrompt, toolDescriptions） |
| `electron/ipc/agent.js` | 从渲染进程获取当前语言并传给 `runAgent` / `planningAgent` |
| `src/stores/ai.js` | 暴露当前语言偏好 |

#### 实现步骤

1. **i18n 扩展**（`src/utils/i18n.js`）
   - 新增 `agent` 节：`systemPrompt.zh-CN`, `systemPrompt.en`, `systemPrompt.ja`
   - 同上为 `planningPrompt`、`toolDescriptions` 添加三语版本
   - 导出 `getAgentLocale()` 获取当前语言

2. **IPC 层传递语言**（`electron/ipc/agent.js`）
   - `agent:run` 监听参数中增加 `locale` 字段
   - 透传给 `runAgent()` 和 `planningAgent()`

3. **AgentEngine 语言化**（`electron/services/agentEngine.js`）
   - `runAgent()` 签名增加 `locale` 参数
   - 构建 system prompt 时从 i18n 获取对应语言版本
   - `PLANNING_PROMPT` 改为模板函数 `buildPlanningPrompt(locale)`
   - `TOOL_DESCRIPTIONS` 改为函数 `getToolDescriptions(locale)`

4. **前端传递 locale**（`src/components/common/AIInputFooter.vue`）
   - `handleAgentSend()` 调用 `agentRun` 时加上 `locale: i18n.locale`

#### 验证
- 切换 UI 到 English → 发送 "Create a math courseware" → Agent 应英文追问
- 切换 UI 到 日本語 → 送信 "数学の教材を作って" → Agent が日本語で質問
- Agent 回答、规划提示、工具描述均匹配当前语言

---

### 5.6 PPTX 回退幻灯片多语言化

#### 问题
`pptxGenerator.js:159-170` 的 fallback slides 硬编码中文。

#### 改动

| 文件 | 改动 |
|------|------|
| `electron/services/pptxGenerator.js` | fallback text 改为引用 `FALLBACK_TEXTS[lang]` |

#### 实现

```js
const FALLBACK_TEXTS = {
  'zh-CN': { title: '相关内容', desc: '详细内容请参考教材……' },
  'en':    { title: 'Related Content', desc: 'Please refer to the textbook……' },
  'ja':    { title: '関連内容', desc: '詳細は教科書を参照してください……' },
}
```

---

### 5.7 日语问候补充

#### 改动

| 文件 | 改动 |
|------|------|
| `src/stores/ai.js` | `getGreeting()` 增加日语分支 |

```js
if (locale.startsWith('ja')) return 'こんにちは！お手伝いできることはありますか？'
```

---

### 5.8 ContentLibrary 增强（Phase 3 遗留）

#### 问题
内容库无分页、无预览、无文件夹分类。

#### 改动文件

| 文件 | 改动 |
|------|------|
| `src/components/views/ContentLibrary.vue` | 新增分页、文件类型过滤、卡片预览图 |

#### 实现步骤

1. **后端 IPC 支持分页**
   - `electron/ipc/settings.js` → `scan-directory` 增加 `page` / `pageSize` 参数
   - 返回 `{ files, total, page, pageSize }`

2. **前端分页组件**
   - `ContentLibrary.vue` 引入 `el-pagination`
   - 每页 12 个文件，支持切换页大小

3. **文件类型过滤**
   - 顶部 Tab: 「全部｜课件（.pptx）｜讲义（.docx）｜练习（.json）」
   - 根据 `meta.json` 中的 `type` 字段过滤

4. **预览缩略图**
   - 读取 `.meta.json` 中 `thumbnail` 字段（base64 首屏截图）
   - 无缩略图时显示文件类型图标占位

---

### 5.9 构建优化

#### 问题
主 JS chunk 1083 kB，超过推荐阈值。

#### 改动

| 文件 | 改动 |
|------|------|
| `vite.config.js` | 添加 `manualChunks` 拆分 katex、docx、pptxgenjs |

```js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        katex: ['katex'],
        office: ['pptxgenjs', 'docx'],
        vendor: ['vue', 'pinia', 'element-plus'],
      }
    }
  }
}
```

---

## 执行顺序

| 顺序 | 任务 | 估计工时 | 依赖 |
|------|------|----------|------|
| 1 | 5.5 Agent 多语言适配 | 4h | 无 |
| 2 | 5.6 PPTX fallback 多语言 | 0.5h | 1（复用 i18n 框架） |
| 3 | 5.7 日语问候 | 0.2h | 无 |
| 4 | 5.8 ContentLibrary 增强 | 3h | 无 |
| 5 | 5.9 构建优化 | 0.5h | 无 |

## 验收标准

- [ ] 切换 UI 语言后，Agent 的提问、回答、工具描述全部跟随
- [ ] 规划模式（Phase 4）在多语言下正常工作
- [ ] LLM 生成 PPTX 失败时 fallback 文本使用正确的语言
- [ ] 日语用户看到日语问候
- [ ] ContentLibrary 支持分页（≥100 文件不卡顿）和文件类型过滤
- [ ] 构建后无 JS chunk 超过 500 kB（gzip）
- [ ] `npm run build` 0 error

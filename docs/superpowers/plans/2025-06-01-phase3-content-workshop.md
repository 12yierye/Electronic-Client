# Phase 3 — 内容工坊 实施计划

> **Goal:** 从基础课件生成升级为完整的智能内容创作系统——支持图表/表格/图片幻灯片、多轮修改对话、完整教案包输出、模板系统和内容库。

**Architecture:** pptxgenjs 生成 PPTX + JSON 元数据实现可编辑性，`docx` 库生成讲义，aiStore 管理模板，文件系统管理内容库。

**Tech Stack:** pptxgenjs 4.x, docx 9.x, Node.js fs/path, Pinia, Vue 3

---

## 模块一：增强 PPTX 生成（Multi-type Slides）

### Task 1.1: 安装 docx 依赖

```bash
npm install docx
```

### Task 1.2: 扩展 LLM 大纲生成（`electron/services/pptxGenerator.js`）

当前 LLM 只输出 `type: 'title'|'content'|'bullets'|'exercise'|'summary'`。

扩展 prompt 支持新 slide 类型：

```
新增类型：
- chart: { type: 'chart', title: '...', chartData: { type: 'bar'|'pie'|'line', labels: [...], series: [{ name: '...', values: [...] }] } }
- table: { type: 'table', title: '...', headers: [...], rows: [[...], [...]] }
- compare: { type: 'compare', title: '...', left: { title: '...', items: [...] }, right: { title: '...', items: [...] } }
- image: { type: 'image', title: '...', description: '...' }
```

### Task 1.3: 图表渲染函数（`pptxGenerator.js`）

```js
function renderChartSlide(slide, data, pres, theme) {
  const chartType = data.chartData.type === 'pie' ? pres.charts.PIE
    : data.chartData.type === 'line' ? pres.charts.LINE
    : pres.charts.BAR

  slide.addText(data.title, { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent })
  slide.addChart(chartType, data.chartData.series, {
    x: 1, y: 1.5, w: 11, h: 4.5,
    showTitle: false, showLegend: true, legendPos: 'b',
    showValue: true, chartColors: [theme.accent, 'E67E22', '27AE60', '9B59B6', 'F39C12']
  })
}
```

### Task 1.4: 表格渲染函数

```js
function renderTableSlide(slide, data, theme) {
  slide.addText(data.title, { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent })
  const rows = [data.headers.map(h => ({ text: h, options: { bold: true, fill: { color: theme.accent }, color: 'FFFFFF' } })), ...data.rows.map(r => r.map(c => ({ text: String(c) })))]
  slide.addTable(rows, { x: 1, y: 1.5, w: 11, colW: data.headers.map(() => 11 / data.headers.length), border: { type: 'solid', pt: 0.5, color: 'CCCCCC' } })
}
```

### Task 1.5: 对比页渲染

```js
function renderCompareSlide(slide, data, theme) {
  slide.addText(data.title, { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent })
  slide.addText(data.left.title, { x: 1, y: 1.3, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: theme.accent })
  slide.addText(data.left.items.map(i => '· ' + i).join('\n'), { x: 1, y: 1.8, w: 5.5, h: 5, fontSize: 14, color: theme.textColor, valign: 'top' })
  slide.addShape(pres.ShapeType.rect, { x: 6.5, y: 1.5, w: 0.02, h: 5, fill: { color: theme.accent } })
  slide.addText(data.right.title, { x: 6.8, y: 1.3, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: '#E67E22' })
  slide.addText(data.right.items.map(i => '· ' + i).join('\n'), { x: 6.8, y: 1.8, w: 5.5, h: 5, fontSize: 14, color: theme.textColor, valign: 'top' })
}
```

---

## 模块二：多轮修改对话

### Task 2.1: 元数据持久化（`pptxGenerator.js`）

每次生成 PPTX 时，同步保存 `.meta.json`：

```js
// 生成 PPTX 后
const metaPath = savePath.replace('.pptx', '.meta.json')
fs.writeFileSync(metaPath, JSON.stringify({
  topic, detail, slideCount, outline, theme: outline.theme,
  createdAt: new Date().toISOString()
}))
```

### Task 2.2: 新增 `edit_pptx` Tool（`toolRegistry.js`）

```js
this.register({
  name: 'edit_pptx',
  description: 'Edit a previously generated PPTX file. Can modify slide content, add/remove slides, change styling.',
  parameters: {
    type: 'object',
    properties: {
      pptxPath: { type: 'string', description: 'Path to the .pptx file to edit' },
      instructions: { type: 'string', description: 'What to change (e.g. "第3页字号调大", "加一页习题")' }
    },
    required: ['pptxPath', 'instructions']
  },
  handler: async (params, ctx) => {
    // 1. Load meta.json
    // 2. Send instructions + current outline to LLM → get modified outline
    // 3. Regenerate PPTX from modified outline
    // 4. Save new meta.json
    return { success: true, path: newPath, fileName }
  }
})
```

### Task 2.3: 编辑流程

```
用户: "把第三页字号调大"
  ↓ Agent 解析意图
  ↓ 调用 edit_pptx(pptxPath, "第三页字号调大")
  ↓ Load meta.json → get current slide 3 data
  ↓ LLM: { ...slide3, fontSize: slide3.fontSize + 4 }
  ↓ Regenerate PPTX → save
  ↓ 返回新文件路径
AI: "已将第三页字号调大到 32pt，点击打开修改后的课件"
```

### Task 2.4: 前端显示编辑结果

PPT 卡片更新为新文件路径，旧文件保留。

---

## 模块三：完整教案包

### Task 3.1: 新增 `generate_lesson_package` Tool

调用后产出：
1. `.pptx` 课件（现有）
2. `.docx` 讲义（docx 库生成）
3. 随堂练习题（JSON → 附加 PPTX slides 或独立 .md）

### Task 3.2: 讲义生成（`electron/services/handoutGenerator.js`）

```js
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

async function generateHandout(outline, topic) {
  const doc = new Document({ ... })
  for (const slide of outline.slides) {
    doc.addSection({
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(slide.title)] }),
        ...(slide.items || []).map(i => new Paragraph({ text: '· ' + i }))
      ]
    })
  }
  return await Packer.toBuffer(doc)
}
```

### Task 3.3: 教案包输出结构

```
<输出目录>/<课题>_教案包/
├── 课件.pptx
├── 课件.meta.json
├── 讲义.docx
├── 练习题.md
└── 教学大纲.md
```

---

## 模块四：模板系统

### Task 4.1: 数据模型

```js
// localStorage key: 'ai_templates'
[
  {
    id: 'tpl_001',
    name: '蓝色学术',
    theme: 'blue',
    font: 'Microsoft YaHei',
    colors: { primary: '1B3A5C', accent: '4A9EFF', text: '333333' },
    layout: 'LAYOUT_WIDE',
    slideMaster: { ... }  // pptxgenjs SlideMasterProps
  }
]
```

### Task 4.2: Template Tool + `setTemplate`/`getTemplates`

- `get_templates` Tool：列出可用模板
- `set_default_template` Tool：设置默认模板
- AI 对话中："用蓝色学术模板" → Agent 调用 set_default_template

### Task 4.3: Settings 模板管理 UI

Settings 新增"模板管理"面板：列表、预览、删除、设为默认。

---

## 模块五：内容库

### Task 5.1: 内容库组件（`src/components/views/ContentLibrary.vue`）

```
┌──────────────────────────────────────┐
│  📚 内容库                      搜索 │
├──────────────────────────────────────┤
│  📄 三角函数课件   数学  12页  昨天  │
│  📄 力学教案       物理  15页  前天  │
│  📄 定语从句       英语   8页  上周  │
└──────────────────────────────────────┘
```

### Task 5.2: 数据源

扫描 PPT 输出目录下的所有 `.meta.json` 文件，提取元数据（topic, slideCount, createdAt）。

### Task 5.3: 操作

| 操作 | 行为 |
|------|------|
| 点击 | 用系统默认程序打开 PPTX |
| 编辑 | 发送到 Agent 进行修改 |
| 删除 | 删除 PPTX + meta.json |

---

## 改动文件清单

### 新增文件（4 个）
| 文件 | 作用 |
|------|------|
| `electron/services/handoutGenerator.js` | .docx 讲义生成 |
| `electron/services/templateManager.js` | 模板 CRUD |
| `src/components/views/ContentLibrary.vue` | 内容库列表 |
| `src/stores/contentLibrary.js` | 内容库 Pinia Store |

### 修改文件（7 个）
| 文件 | 改动 |
|------|------|
| `electron/services/pptxGenerator.js` | 图表/表格/对比 slide 渲染 + meta.json 保存 |
| `electron/services/toolRegistry.js` | 新增 `edit_pptx`、`generate_lesson_package`、`get_templates` 工具 |
| `electron/services/agentEngine.js` | 扩展 system prompt 告知 AI 新 slide 类型 |
| `src/App.vue` | 注册 ContentLibrary 视图 |
| `src/components/layout/AppNavigation.vue` | 新增"内容库"导航项 |
| `src/components/views/Settings.vue` | 模板管理面板 |
| `package.json` | 新增 `docx` 依赖 |

---

## 实施顺序

| 顺序 | 模块 | 原因 |
|------|------|------|
| 1 | 安装 docx + 增强 PPTX 渲染 | 基础能力扩容 |
| 2 | 元数据持久化 + edit_pptx Tool | 多轮修改依赖这个 |
| 3 | 讲义生成 | 独立模块 |
| 4 | 模板系统 | 可后续迭代 |
| 5 | 内容库 | 依赖前面所有模块 |

---

## 预计工作量

- 增强 PPTX：~150 行
- 多轮修改：~120 行
- 讲义生成：~100 行
- 模板系统：~100 行
- 内容库 UI：~200 行
- 工具注册 + IPC：~80 行

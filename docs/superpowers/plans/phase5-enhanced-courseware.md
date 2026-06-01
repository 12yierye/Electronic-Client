# Phase 5 — 课件深度增强

> **目标：** 课件支持图片、公式、动画过渡，以及 LaTeX 公式渲染

---

## 实施任务

### 5.1 图片插入

- LLM 生成图片描述 → 调用图片搜索 API（Unsplash/Pexels）→ 下载并嵌入 PPTX
- 新增 slide 类型 `image`: `{ type: 'image', title: '...', imageUrl: '...', description: '...' }`
- 前端 PPT 卡片显示缩略图预览

### 5.2 LaTeX 公式支持

- 安装 `katex` 依赖用于渲染公式
- PPTX 中公式以 SVG 图片形式嵌入（pptxgenjs 不直接支持公式）
- 对话中公式用 KaTeX 实时渲染（`marked` 插件）

### 5.3 幻灯片过渡动画

- pptxgenjs 支持 slide transition：`slide.transition = { type: 'fade', duration: 0.5 }`
- AI 根据内容自动选择合适过渡

### 5.4 多语言课件

- 根据对话语言自动生成对应语言的课件
- 中文/English/日本語 三语切换

### 5.5 改动文件

| 文件 | 改动 |
|------|------|
| `pptxGenerator.js` | 图片/公式/过渡渲染 |
| `AIChat.vue` | KaTeX 公式展示 |
| `toolRegistry.js` | 新增 `search_images` 工具 |
| `package.json` | 新增 `katex` 依赖 |

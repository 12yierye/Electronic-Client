# Electronic 1.1.0-b — Pre-release

> 个人 AI 助手 · 即时通讯 · 桌面应用
> **Pre-release** — 1.1.0 系列第二个预览版，重点更新 AI 引擎

---

## 关于此版本

这是 **Electronic 1.1.0** 系列的第二个 **Pre-release** 版本，引入 AI Agent 引擎与课件生成能力。

---

## 新增功能

- **AI Agent 引擎** — 工具调用驱动的 AI 智能体，支持链式多工具编排
- **PPTX 课件生成** — AI 根据主题自动生成包含文字、图表、图片的课件
- **DOCX 讲义生成** — AI 一键生成课程讲义文档
- **云端模型配置** — 支持 DeepSeek、OpenAI、通义千问、智谱等多家云端 API
- **模型/对话管理** — 在 AI 页面自由切换模型、新建对话
- **内容库** — 集中管理 AI 生成过的课件，支持浏览、打开、删除

---

## Bug 修复

- 修复了进入设置界面后偶现全部标签页内容消失的问题
- 修复了 AI 对话中上下文丢失的问题
- 修复了 AI 对话中思考过程中出现额外的空容器的问题
- 修复了 AI 对话中偶现流式输出失效的问题
- 修复了 AI 对话中首次对话功能缺失的问题
- 修复了 AI 对话中内容重复出现两次的问题
- 修复了 AI 对话中缺乏用户指引的问题

---

## 技术变更

| 模块 | 关键文件 |
|------|----------|
| Agent 引擎 | `electron/services/agentEngine.js` |
| 工具注册表 | `electron/services/toolRegistry.js` |
| PPTX 生成 | `electron/services/pptxGenerator.js` |
| DOCX 生成 | `electron/services/handoutGenerator.js` |
| 云端 API | `electron/services/cloudProviders.js` |
| 内容库 | `src/components/views/ContentLibrary.vue` |

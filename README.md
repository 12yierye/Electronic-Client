# Electronic

**集 AI 对话、课件生成与校内沟通于一体的桌面应用。**

Electronic 是一个面向教学与办公场景的 Windows 桌面客户端，把日常会用到的几件事放进同一个窗口：和 AI 讨论问题、把想法做成 PPT 课件或讲义、和同事聊天发通知、管理文件与定时任务。AI 既可以接本地模型，也可以接云端模型。

## 主要功能

- **AI 对话**：本地或云端模型，流式回复，支持 Markdown 与公式；需要先理清思路时可开启「规划模式」，让 AI 先提问再给方案。
- **课件生成**：一句话生成 PPT 课件或 DOC 讲义，支持模板、自动配图、公式与过渡动画，成品统一收在「课件库」。
- **AI Agent**：AI 可调用内置工具完成发消息、查联系人、搜图、生成文件、设定时任务等操作。
- **校内沟通**：好友、群聊、广播通知与组织架构，公网和内网可同时在线。
- **文件与任务**：文件上传下载、消息和文件定时发送、断线重连与离线消息。
- **个性化**：深浅主题、界面密度、简体中文 / English / 日本語、桌面通知、自动检查更新。

## 下载与使用

1. 在 [Releases](https://github.com/12yierye/Electronic-Client/releases/latest) 下载最新的 `Electronic x.y.z.exe`。
2. 运行安装程序。安装包未签名，Windows 提示时选择「更多信息 → 仍要运行」。
3. 首次启动后，在登录页填写服务器地址，在「设置」中配置 AI 模型与密钥。

如果只是使用，到这里就够了，不需要安装 Node.js。

## 开发

### 技术栈

- 前端：Vue 3、Element Plus、Pinia、Vite、Sass
- 桌面：Electron 28，主进程负责 IPC、网络、文件、模型调用与更新
- 服务端：Node 版或 Rust 版，见下方相关仓库
- AI：LM Studio 本地接口，或 OpenAI 兼容的云端接口

### 环境要求

Node.js 22+、npm 10+

### 常用命令

```bash
npm install       # 安装依赖
npm run dev       # 浏览器开发，使用 mock API，无需 Electron 与后端
npm run electron  # Electron 桌面开发
npm run build     # 构建前端与主进程
npm run pack      # 打包 Windows 安装程序，输出到 release/
```

### 配置

默认后端地址为 `http://127.0.0.1:3001`，LM Studio 地址为 `http://127.0.0.1:1234/v1`，可在 `electron/config.js` 中修改；云端模型的密钥与模型选择在应用「设置 → AI 对话」中配置。

### 目录结构

```
electron/   主进程入口、IPC 与服务（WebSocket、模型、文件、更新等）
src/        Vue 前端（组件、组合式函数、Pinia、工具）
docs/       更新记录等文档
```

### 架构说明

渲染进程通过 preload 暴露的 `window.electronAPI` 调用 IPC，由主进程统一完成 HTTP、WebSocket、文件与模型请求。视图切换使用动态组件 `<component :is>`，没有引入 Vue Router。浏览器开发模式下 `mockApi` 会自动注入 mock 的 `electronAPI`。

### 相关仓库

- [Electronic-Client](https://github.com/12yierye/Electronic-Client)：桌面客户端
- [Electronic-Server](https://github.com/12yierye/Electronic-Server)：Node 服务端
- [Electronic-Server-Rust](https://github.com/12yierye/Electronic-Server-Rust)：Rust 服务端
- [Electronic-Manager](https://github.com/12yierye/Electronic-Manager)：管理端
- [12yierye.github.io](https://12yierye.github.io)：项目介绍页

## 其他

- 更新记录：[docs/changelog](docs/changelog)
- 许可证：ISC
- 作者：FireOut

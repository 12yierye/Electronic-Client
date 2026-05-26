# Electronic - 个人AI助手桌面应用

## 项目概述

Electronic 是一个基于 **Vue 3 + Electron** 构建的桌面端个人 AI 助手应用，集成了 AI 智能对话、即时通讯（公网 + 内网）、文件管理、定时任务等功能。

## 项目结构

```
Electronic-Client/
├── electron/                    # Electron 主进程
│   ├── index.js                 # 主进程入口
│   ├── config.js                # 配置常量 (API 地址、模型配置)
│   ├── window.js                # 窗口创建与管理
│   ├── preload.cjs              # 预加载脚本 (contextBridge)
│   ├── ipc/                     # IPC 通信模块
│   │   ├── ai.js                # AI 聊天 (LM Studio 集成)
│   │   ├── auth.js              # 用户认证
│   │   ├── file.js              # 文件操作
│   │   ├── task.js              # 定时任务
│   │   └── user.js              # 用户/好友/聊天
│   └── services/                # 服务模块
│       ├── scheduledTasks.js    # 定时任务持久化
│       └── serverApi.js         # 服务端 API 封装
│
├── src/                         # Vue 3 前端源码
│   ├── main.js                  # 应用入口
│   ├── App.vue                  # 根组件 (动态视图切换)
│   ├── assets/
│   │   └── styles/
│   │       └── main.scss        # 全局样式 + CSS 变量 (暗/亮主题)
│   ├── components/
│   │   ├── common/
│   │   │   └── AIInputFooter.vue  # AI 聊天底部输入栏
│   │   ├── layout/
│   │   │   ├── AppNavigation.vue  # 顶部导航栏
│   │   │   └── AppSidebar.vue     # 侧边栏 (用户信息/连接状态)
│   │   └── views/
│   │       ├── AIChat.vue         # AI 对话视图
│   │       ├── ChatRoom.vue       # 聊天室视图
│   │       ├── FileManager.vue    # 文件管理视图
│   │       ├── Login.vue          # 登录/注册视图
│   │       └── Settings.vue       # 设置视图
│   ├── composables/             # 组合式函数
│   │   ├── useChatRoom.js       # 聊天室核心业务逻辑
│   │   ├── useI18n.js           # 国际化
│   │   └── useScheduledTask.js  # 定时任务意图解析
│   ├── stores/                  # Pinia 状态管理
│   │   ├── ai.js                # AI 聊天状态
│   │   ├── settings.js          # 设置状态 (主题/语言)
│   │   └── user.js              # 用户状态
│   └── utils/
│       ├── i18n.js              # 多语言翻译数据 (中/英/日)
│       ├── mockApi.js           # 浏览器 Mock API (开发用)
│       └── pinyin.js            # 拼音搜索匹配
│
├── index.html                   # HTML 入口
├── vite.config.js               # Vite 构建配置
├── package.json                 # 项目配置
└── res/                         # 静态资源 (图标/图片)
```

## 技术栈

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | ^3.4 | 前端框架 (Composition API + `<script setup>`) |
| Element Plus | ^2.5 | UI 组件库 |
| Pinia | ^2.1 | 状态管理 |
| Vite | ^5.0 | 构建工具 |
| Sass | ^1.69 | CSS 预处理器 |
| marked | ^17.0 | Markdown 渲染 (AI 回复) |
| Axios | ^1.6 | HTTP 客户端 |

### 桌面端 & 后端
| 技术 | 用途 |
|------|------|
| Electron 28 | 桌面应用框架 |
| vite-plugin-electron | Vite + Electron 集成 |
| LM Studio API | 本地 AI 大模型 (OpenAI 兼容接口) |
| Express + Socket.IO | 后端服务器 |

## 核心功能

### AI 对话
- 集成 LM Studio 本地大模型，支持流式输出
- Markdown 实时渲染回复内容
- 思考内容展开/折叠
- 自动问候语生成

### 聊天室
- **双模式**: 公网模式 (通过后端服务器) + 内网模式 (局域网直连)
- 好友管理: 添加、删除、星标
- 好友申请: 发送、接收、审批
- **群聊功能**: 内网模式下支持创建/解散群聊
- **拼音搜索**: 好友列表支持拼音模糊匹配
- 图片消息支持

### 文件管理
- 文件上传 (支持拖拽)
- 文件下载与删除
- localStorage 缓存文件列表

### 定时任务
- AI 自然语言意图解析 (如 "15:30 向张三发送 report.docx")
- 定时发送文件/消息
- 任务持久化与恢复

### 系统特性
- **暗/亮主题**: CSS 变量驱动，一键切换
- **多语言**: 简体中文 / English / 日本語
- **自动登录**: 30 天凭证有效
- **心跳检测**: 每 5 秒检测连接延迟与丢包率

## 架构设计

### 数据流

```
Vue 3 前端界面
    ↓ window.electronAPI (contextBridge)
Electron 主进程 (IPC Handlers)
    ↓ Axios HTTP
┌───────────────────┬─────────────────────────┐
│  后端服务器         │  LM Studio 本地 API      │
│  (127.0.0.1:3000) │  (127.0.0.1:1234/v1)    │
│  用户/好友/聊天/文件  │  AI 大模型推理            │
└───────────────────┴─────────────────────────┘
```

### 开发模式

浏览器开发模式下，`mockApi.js` 自动注入 mock `electronAPI`，无需启动 Electron 和后端服务器即可进行前端开发。

### 视图切换

采用动态组件 `<component :is="">` 手动控制视图切换，未使用 Vue Router。

## 快速开始

### 环境要求

- Node.js 22.20+ (LTS)
- npm 10+

### 安装与运行

```bash
# 安装依赖
npm install

# 浏览器开发模式 (无需 Electron)
npm run dev

# Electron 桌面应用模式
npm run electron

# 构建桌面应用
npm run build
```

### 配合后端服务器

```bash
# 启动后端服务器
npm run server

# 确保 LM Studio 在本地运行 (端口 1234)
```

### 配置

编辑 `electron/config.js` 修改服务器地址：

```js
API_BASE: 'http://127.0.0.1:3000'       // 后端服务器
LM_STUDIO_API: 'http://127.0.0.1:1234/v1' // LM Studio API
```

## API 概览

### 用户
- `POST /login` - 用户登录
- `POST /register` - 用户注册
- `GET /users/search?q=` - 搜索用户

### 好友
- `GET /users/friends?username=` - 获取好友列表
- `POST /users/friends/add` - 添加好友
- `POST /users/friends/remove` - 移除好友

### 聊天
- `POST /chat/send` - 发送消息
- `GET /chat/messages?sender=&receiver=` - 获取聊天记录

### 文件
- `GET /user/files?username=` - 获取文件列表
- `POST /user/upload` - 上传文件
- `GET /user/download/:username/:filename` - 下载文件

## 构建产物

构建后输出到 `dist/` 目录，同时生成 `dist-electron/` 目录包含 Electron 主进程代码。

支持的 Windows 安装包格式：
- NSIS 安装程序 (`.exe`)
- Portable 便携版 (`.exe`)

## 许可证

ISC

## 作者

FireOut

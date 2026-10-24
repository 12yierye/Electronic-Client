# Electronic 1.1.3

## 新功能

- 自动检查更新开关（默认关闭），开启后启动时静默检查
- 界面密度设置（紧凑 / 标准），全局生效
- 联系人预览卡片与单个会话删除
- 从 OpenAI 兼容接口拉取云端可用模型

## 功能改进

- 更新检查支持手动 / 强制检查，展示版本与更新说明，打包环境可直接下载安装
- 更新请求改用系统网络栈，兼容系统代理与证书，并增加重试与失败静默处理
- 优化聊天与设置页面布局及整体样式

## Bug 修复

- 修复启动时卡在加载页的问题
- 修复多网络源（公网 / 内网）下会话键冲突
- 修复 WebSocket 重连竞态，避免旧连接事件覆盖新连接
- 修复检查更新失败时向界面推送无意义提示的问题

## 详细说明

- 新增 `src/utils/apiFetch.js` 统一请求并自动附带 JWT；新增 `src/utils/serverUrl.js` 统一公网/内网地址解析，默认端口 3001
- 主进程 Axios 默认注入认证头；新增 `list-cloud-models` IPC
- `autoUpdater` 重构：GitHub API 比对版本 + `electron-updater` 下载，`net.request` 复用系统证书与代理，3 次重试，失败仅记录日志
- 设置项 `uiDensity` 通过 CSS 变量全局生效，兼容旧 `friendListDensity` 配置
- 修复 `useChatRoom.js` 头部重复 UTF-8 BOM 导致 Vite 未重写 `vue` 导入；新增 `jsconfig.json` 关闭大小写一致性校验
- WebSocket 连接使用局部 socket 引用，避免重连后旧连接事件覆盖新连接状态

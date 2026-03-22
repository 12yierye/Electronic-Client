# Electronic - 项目结构说明

## 项目概述
Electronic 是一个基于 Electron 的个人AI助手应用,提供AI对话、好友聊天、文件管理等功能。

## 项目结构

```
e:/Electron/
├── html/                    # HTML页面文件
│   ├── login.html          # 登录页面
│   ├── register.html       # 注册页面
│   └── mainPage.html       # 主页面(已移除学生端页面)
│
├── scripts/                # JavaScript脚本文件
│   ├── ai.js              # AI对话功能模块
│   ├── chat.js            # 聊天系统功能模块
│   ├── files.js           # 文件管理功能模块
│   ├── login.js           # 登录功能模块
│   ├── mainPage.js        # 主页面控制模块
│   └── settings.js        # 设置功能模块
│
├── styles/                # CSS样式文件
│   ├── ai.css            # AI对话样式
│   ├── chat.css          # 聊天界面样式
│   ├── files.css         # 文件管理样式
│   ├── login.css         # 登录页面样式
│   ├── main.css          # 主页面通用样式
│   └── settings.css      # 设置页面样式
│
├── res/                   # 资源文件
│   ├── Head.png          # 默认头像
│   ├── Send2.png         # 发送按钮图标
│   ├── Upload1.png       # 上传按钮图标
│   └── ...               # 其他资源文件
│
├── index.js              # Electron主进程入口文件
├── preload.js            # 预加载脚本
├── package.json          # 项目配置文件
├── package-lock.json     # 依赖版本锁定文件
└── 关于.md               # 项目部署说明文档
```

## 主要功能模块

### 1. AI对话模块 (ai.js)
- 提供与AI的对话功能
- 支持用户消息和AI回复的显示
- 自动问候语功能
- 多语言支持

### 2. 聊天系统模块 (chat.js)
- 好友管理(添加、移除、星标)
- 好友申请(发送、接收、处理)
- 实时聊天功能
- 聊天记录管理
- 搜索用户功能

### 3. 文件管理模块 (files.js)
- 文件上传功能
- 文件下载功能
- 文件删除功能
- 文件列表显示
- 与服务器同步文件

### 4. 设置模块 (settings.js)
- 主题切换(深色/浅色)
- 语言切换(中文/英文)
- 用户偏好设置

### 5. 主页面控制 (mainPage.js)
- 页面导航管理
- 用户信息显示
- 侧边栏管理
- 登出功能
- 服务器连接监控

## 技术栈

### 前端技术
- HTML5
- CSS3 (支持深色/浅色主题)
- JavaScript (ES6+)

### 后端技术
- Node.js
- Electron (桌面应用框架)
- Express (Web服务器)
- Socket.IO (实时通信)
- Axios (HTTP客户端)

## API端点

### 用户相关
- `POST /login` - 用户登录
- `POST /register` - 用户注册
- `GET /users` - 获取用户列表
- `GET /users/search?q=` - 搜索用户

### 好友相关
- `GET /users/friends?username=` - 获取好友列表
- `POST /users/friends/add` - 添加好友
- `POST /users/friends/remove` - 移除好友
- `POST /users/star` - 星标用户
- `GET /users/starred?username=` - 获取星标用户列表

### 好友申请相关
- `POST /friends/requests/send` - 发送好友申请
- `GET /friends/requests?username=&type=` - 获取好友申请列表
- `POST /friends/requests/handle` - 处理好友申请

### 聊天相关
- `POST /chat/send` - 发送聊天消息
- `GET /chat/messages?sender=&receiver=` - 获取聊天记录

### 文件相关
- `GET /user/files?username=` - 获取文件列表
- `POST /user/upload?username=&filename=` - 上传文件
- `GET /user/download/:username/:filename` - 下载文件
- `DELETE /user/file/:username/:filename` - 删除文件

## 代码规范

### 命名规范
- 文件名: 使用小写字母和连字符 (kebab-case)
- 变量名: 使用驼峰命名法 (camelCase)
- 常量名: 使用大写字母和下划线 (UPPER_SNAKE_CASE)
- 函数名: 使用驼峰命名法,动词开头
- 类名: 使用帕斯卡命名法 (PascalCase)

### 代码格式
- 使用4空格缩进
- 每行最大长度120字符
- 运算符前后添加空格
- 逗号后添加空格
- 避免一行多语句
- 适当添加注释说明功能

### 注释规范
- 文件头部添加文件功能说明
- 复杂逻辑添加详细注释
- 函数添加JSDoc注释说明参数和返回值
- 重要代码行添加行内注释

## 优化说明

### 已完成的优化
1. ✅ 删除学生端相关文件
2. ✅ 清理主入口文件中的学生端逻辑
3. ✅ 将压缩的代码拆分为多行,提高可读性
4. ✅ 简化CSS样式,添加详细注释
5. ✅ 简化JavaScript逻辑,移除冗余代码
6. ✅ 统一代码风格和命名规范
7. ✅ 添加必要的注释说明功能

### 代码可读性改进
- 将多行属性拆分为单行
- 添加清晰的功能注释
- 优化代码缩进和格式
- 移除不必要的空行
- 统一使用一致的命名规范

## 启动说明

### 客户端启动
```bash
# 确保已安装 Node.js 22.20 (LTS)
node -v
npm -v

# 安装依赖
npm install

# 启动应用
npm start
```

### 服务端启动
```bash
# 确保服务运行在 http://192.168.61.129:3000

# 使用 PM2 启动(生产环境)
pm2 start server.js
pm2 save
pm2 startup
```

## 注意事项

1. 确保服务器在 `http://192.168.61.129:3000` 运行
2. 客户端和服务端需要在同一网络环境
3. 防火墙需要开放相应端口
4. 生产环境建议使用 PM2 进行进程管理

## 许可证
ISC

## 作者
elec

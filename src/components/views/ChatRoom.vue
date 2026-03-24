<template>
  <div class="chat-room-view">
    <el-container>
      <!-- 左侧好友列表 -->
      <el-aside width="280px">
        <div class="chat-tabs">
          <!-- 聊天模式切换 -->
          <el-radio-group v-model="chatMode" size="small" @change="handleChatModeChange">
            <el-radio-button label="public">公网</el-radio-button>
            <el-radio-button v-if="useLanChat" label="lan">内网</el-radio-button>
          </el-radio-group>
          
          <el-radio-group v-model="activeTab" size="small">
            <el-radio-button label="friends">好友</el-radio-button>
            <el-radio-button label="add">添加好友</el-radio-button>
            <el-radio-button label="requests">申请</el-radio-button>
          </el-radio-group>
        </div>
        
        <!-- 搜索框 -->
        <div class="search-box">
          <el-input
            v-model="searchQuery"
            placeholder="搜索用户..."
            :prefix-icon="Search"
            clearable
            @input="handleSearch"
          />
        </div>
        
        <!-- 好友/用户列表 -->
        <div class="user-list">
          <template v-if="activeTab === 'friends'">
            <!-- 公网好友列表 -->
            <template v-if="chatMode === 'public'">
              <div 
                v-for="friend in friendsList" 
                :key="friend.username"
                :class="['user-item', { active: selectedUser?.username === friend.username }]"
                @click="selectUser(friend, 'public')"
              >
                <el-avatar :size="40">{{ friend.username.charAt(0).toUpperCase() }}</el-avatar>
                <div class="user-info">
                  <div class="user-name">{{ friend.username }}</div>
                </div>
                <el-icon 
                  v-if="friend.starred" 
                  class="star-icon starred"
                ><Star /></el-icon>
              </div>
              <el-empty v-if="friendsList.length === 0" description="暂无好友" />
            </template>
            
            <!-- 内网好友列表 -->
            <template v-else>
              <div 
                v-for="friend in lanFriendsList" 
                :key="friend.username"
                :class="['user-item', { active: selectedUser?.username === friend.username }]"
                @click="selectUser(friend, 'lan')"
              >
                <el-avatar :size="40">{{ friend.username.charAt(0).toUpperCase() }}</el-avatar>
                <div class="user-info">
                  <div class="user-name">{{ friend.username }}</div>
                  <div class="user-role">内网</div>
                </div>
              </div>
              <el-empty v-if="lanFriendsList.length === 0" description="内网中暂无在线用户" />
            </template>
          </template>
          
          <template v-else-if="activeTab === 'add'">
            <div 
              v-for="user in filteredUsers" 
              :key="user.username"
              class="user-item"
            >
              <el-avatar :size="40">{{ user.username.charAt(0).toUpperCase() }}</el-avatar>
              <div class="user-info">
                <div class="user-name">{{ user.username }}</div>
              </div>
              <el-button size="small" type="primary" @click="handleAddFriend(user)">
                添加
              </el-button>
            </div>
            <el-empty v-if="filteredUsers.length === 0" description="未找到用户" />
          </template>
          
          <template v-else>
            <div 
              v-for="request in friendRequests" 
              :key="request.id"
              class="request-item"
            >
              <el-avatar :size="40">{{ request.sender.charAt(0).toUpperCase() }}</el-avatar>
              <div class="request-info">
                <div class="user-name">{{ request.sender }}</div>
                <div class="request-date">{{ formatDate(request.timestamp) }}</div>
              </div>
              <div class="request-actions">
                <el-button size="small" type="success" @click="handleRequest(request.id, 'accept')">
                  接受
                </el-button>
                <el-button size="small" type="danger" @click="handleRequest(request.id, 'reject')">
                  拒绝
                </el-button>
              </div>
            </div>
            <el-empty v-if="friendRequests.length === 0" description="暂无好友申请" />
          </template>
        </div>
      </el-aside>
      
      <!-- 右侧聊天区域 -->
      <el-main>
        <div class="chat-main">
          <div class="chat-header">
            <span v-if="selectedUser">{{ selectedUser.username }}</span>
            <span v-else class="placeholder">选择一个用户开始聊天</span>
          </div>
          
          <div class="chat-messages" ref="chatMessagesRef">
            <template v-if="selectedUser">
              <div 
                v-for="msg in chatMessages" 
                :key="msg.id"
                :class="['chat-message', msg.sender === currentUsername ? 'sent' : 'received']"
              >
                <!-- 图片消息 -->
                <div v-if="isImageMessage(msg.message)" class="message-content image-message">
                  <img :src="msg.message" alt="图片" @load="onImageLoad" />
                </div>
                <!-- 文本消息 -->
                <div v-else class="message-content">{{ msg.message }}</div>
                <div class="message-time">{{ formatMessageTime(msg.timestamp) }}</div>
              </div>
              <el-empty v-if="chatMessages.length === 0" description="暂无聊天记录" />
            </template>
            <el-empty v-else description="选择一个用户开始聊天" />
          </div>
          
          <div class="chat-input">
            <!-- 图片上传按钮 -->
            <el-upload
              v-if="selectedUser"
              class="image-uploader"
              :show-file-list="false"
              :auto-upload="false"
              :on-change="handleImageSelect"
              accept="image/*"
            >
              <el-button :icon="Picture" circle size="small" />
            </el-upload>
            <el-input
              v-model="inputMessage"
              placeholder="输入消息..."
              :disabled="!selectedUser"
              @keydown.enter.exact="sendMessage"
            />
            <el-button 
              type="primary" 
              :icon="Promotion" 
              :disabled="!selectedUser || !inputMessage.trim()"
              @click="sendMessage"
            />
          </div>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Search, Star, Promotion, Picture } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 状态
const activeTab = ref('friends')
const chatMode = ref('public')  // 'public' 或 'lan'
const useLanChat = ref(false)
const lanSettings = ref({ useLanChat: false, lanServerIP: '', lanServerPort: '3001' })
const searchQuery = ref('')
const selectedUser = ref(null)
const inputMessage = ref('')
const friendsList = ref([])
const allUsersList = ref([])
const friendRequests = ref([])
const chatMessages = ref([])
const lanFriendsList = ref([])  // 内网好友列表

// 计算属性
const currentUsername = computed(() => {
  const user = localStorage.getItem('userInfo')
  return user ? JSON.parse(user).username : ''
})

const filteredUsers = computed(() => {
  if (!searchQuery.value) return allUsersList.value
  const query = searchQuery.value.toLowerCase()
  return allUsersList.value.filter(u => 
    u.username.toLowerCase().includes(query) ||
    u.email?.toLowerCase().includes(query)
  )
})

// 方法
const loadFriendsList = async () => {
  if (window.electronAPI) {
    const result = await window.electronAPI.getFriendsList(currentUsername.value)
    if (result.success) {
      friendsList.value = result.friends || []
    }
  }
}

const loadAllUsers = async () => {
  if (window.electronAPI) {
    const result = await window.electronAPI.getUserList()
    if (result.success) {
      allUsersList.value = result.users || []
    }
  }
}

const loadFriendRequests = async () => {
  if (window.electronAPI) {
    const result = await window.electronAPI.getFriendRequests(currentUsername.value, 'received')
    if (result.success) {
      friendRequests.value = result.requests || []
    }
  }
}

const selectUser = async (user, mode = chatMode.value) => {
  selectedUser.value = { ...user, chatMode: mode }
  if (mode === 'lan') {
    await loadLanChatMessages()
  } else {
    await loadChatMessages()
  }
}

const loadChatMessages = async () => {
  if (!selectedUser.value || !window.electronAPI) return
  
  const result = await window.electronAPI.getChatMessages(
    currentUsername.value,
    selectedUser.value.username
  )
  if (result.success) {
    chatMessages.value = result.messages || []
  }
}

// 加载内网聊天消息
const loadLanChatMessages = async () => {
  if (!selectedUser.value || !lanSettings.value.useLanChat) return
  
  try {
    const response = await fetch(
      `http://${lanSettings.value.lanServerIP}:${lanSettings.value.lanServerPort}/api/messages?from=${encodeURIComponent(currentUsername.value)}&to=${encodeURIComponent(selectedUser.value.username)}`,
      { method: 'GET' }
    )
    const data = await response.json()
    if (data.success) {
      chatMessages.value = data.messages || []
    }
  } catch (error) {
    console.error('加载内网消息失败:', error)
  }
}

// 发送内网消息
const sendLanMessage = async () => {
  const message = inputMessage.value.trim()
  if (!message || !selectedUser.value || !lanSettings.value.useLanChat) return
  
  try {
    const response = await fetch(
      `http://${lanSettings.value.lanServerIP}:${lanSettings.value.lanServerPort}/api/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: currentUsername.value,
          to: selectedUser.value.username,
          message: message,
          timestamp: new Date().toISOString()
        })
      }
    )
    const data = await response.json()
    if (data.success) {
      chatMessages.value.push(data.message)
      inputMessage.value = ''
    }
  } catch (error) {
    console.error('发送内网消息失败:', error)
    ElMessage.error('发送失败: ' + error.message)
  }
}

const sendMessage = async () => {
  // 如果是内网模式，使用内网发送
  if (selectedUser.value?.chatMode === 'lan') {
    await sendLanMessage()
    return
  }
  const message = inputMessage.value.trim()
  if (!message || !selectedUser.value || !window.electronAPI) return
  
  const result = await window.electronAPI.sendChatMessage({
    sender: currentUsername.value,
    receiver: selectedUser.value.username,
    message,
    timestamp: new Date().toISOString()
  })
  
  if (result.success) {
    chatMessages.value.push(result.data)
    inputMessage.value = ''
  }
}

// 处理图片选择
const handleImageSelect = async (file) => {
  if (!selectedUser.value || !window.electronAPI) return
  
  // 将图片转换为 base64
  const reader = new FileReader()
  reader.onload = async (e) => {
    const base64Image = e.target.result
    
    const result = await window.electronAPI.sendChatMessage({
      sender: currentUsername.value,
      receiver: selectedUser.value.username,
      message: base64Image,
      messageType: 'image',
      timestamp: new Date().toISOString()
    })
    
    if (result.success) {
      chatMessages.value.push(result.data)
    }
  }
  reader.readAsDataURL(file.raw)
}

const handleAddFriend = async (user) => {
  if (!window.electronAPI) return
  
  const result = await window.electronAPI.addFriend(currentUsername.value, user.username)
  if (result.success) {
    ElMessage.success('添加成功')
    await loadFriendsList()
  } else {
    ElMessage.error(result.message)
  }
}

const handleRequest = async (requestId, action) => {
  if (!window.electronAPI) return
  
  const result = await window.electronAPI.handleFriendRequest(requestId, action)
  if (result.success) {
    ElMessage.success(action === 'accept' ? '已接受' : '已拒绝')
    await loadFriendRequests()
    await loadFriendsList()
  }
}

const handleSearch = (query) => {
  // 搜索逻辑
}

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

const formatMessageTime = (timestamp) => {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 判断是否为图片URL
const isImageMessage = (message) => {
  if (!message) return false
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
  const lowerMessage = message.toLowerCase()
  
  // 检查是否是图片URL
  if (lowerMessage.startsWith('http://') || lowerMessage.startsWith('https://')) {
    return imageExtensions.some(ext => lowerMessage.includes(ext)) || 
           lowerMessage.includes('image') ||
           lowerMessage.includes('photo') ||
           lowerMessage.includes('img')
  }
  
  // 检查是否是base64图片
  if (lowerMessage.startsWith('data:image/')) {
    return true
  }
  
  return false
}

// 图片加载完成后的回调
const onImageLoad = () => {
  // 滚动到底部
}

// 初始化
onMounted(() => {
  // 加载内网设置
  const savedLanSettings = localStorage.getItem('lanChatSettings')
  if (savedLanSettings) {
    lanSettings.value = JSON.parse(savedLanSettings)
    useLanChat.value = lanSettings.value.useLanChat
  }
  
  loadFriendsList()
  loadAllUsers()
  loadFriendRequests()
  
  // 如果启用了内网聊天，加载内网好友
  if (useLanChat.value) {
    loadLanFriendsList()
  }
})

// 切换聊天模式
const handleChatModeChange = async (mode) => {
  chatMessages.value = []
  selectedUser.value = null
  
  if (mode === 'lan') {
    // 切换到内网聊天
    await loadLanFriendsList()
  } else {
    // 切换到公网聊天
    await loadFriendsList()
  }
}

// 加载内网好友列表
const loadLanFriendsList = async () => {
  if (!lanSettings.value.useLanChat || !lanSettings.value.lanServerIP) return
  
  try {
    const response = await fetch(
      `http://${lanSettings.value.lanServerIP}:${lanSettings.value.lanServerPort}/api/friends`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    )
    const data = await response.json()
    if (data.success) {
      lanFriendsList.value = data.friends || []
    }
  } catch (error) {
    console.error('加载内网好友失败:', error)
  }
}
</script>

<style lang="scss" scoped>
.chat-room-view {
  height: calc(100vh - 60px);
  
  .el-container {
    height: 100%;
  }
  
  .el-aside {
    background: var(--bg-secondary);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
  }
  
  .chat-tabs {
    padding: 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .search-box {
    padding: 10px 15px;
  }
  
  .user-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    
    .user-item, .request-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: rgba(52, 152, 219, 0.1);
      }
      
      &.active {
        background: rgba(52, 152, 219, 0.2);
      }
      
      .user-info {
        flex: 1;
        
        .user-name {
          font-weight: 500;
          color: var(--text-primary);
        }
        
        .user-role, .request-date {
          font-size: 12px;
          color: var(--text-secondary);
        }
      }
      
      .star-icon {
        color: #f1c40f;
        
        &.starred {
          color: #f1c40f;
        }
      }
    }
  }
  
  .chat-main {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
    
    .chat-header {
      padding: 15px 20px;
      background: var(--bg-secondary);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 16px;
      font-weight: 500;
      color: var(--text-primary);
      
      .placeholder {
        color: var(--text-secondary);
      }
    }
    
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      
      .chat-message {
        margin-bottom: 15px;
        max-width: 70%;
        
        &.sent {
          margin-left: auto;
          
          .message-content {
            background: var(--accent-color);
            color: white;
          }
        }
        
        &.received {
          .message-content {
            background: var(--bg-secondary);
            color: var(--text-primary);
          }
        }
        
        .message-content {
          padding: 10px 15px;
          border-radius: 18px;
          word-break: break-word;
          
          &.image-message {
            padding: 5px;
            background: transparent;
            
            img {
              max-width: 200px;
              max-height: 200px;
              border-radius: 12px;
              cursor: pointer;
              transition: transform 0.2s;
              
              &:hover {
                transform: scale(1.05);
              }
            }
          }
        }
        
        .message-time {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 5px;
        }
      }
    }
    
    .chat-input {
      padding: 15px 20px;
      background: var(--bg-secondary);
      display: flex;
      align-items: center;
      gap: 10px;
      
      .image-uploader {
        display: inline-block;
        
        :deep(.el-upload) {
          border: none;
        }
      }
      
      .el-input {
        flex: 1;
        
        :deep(.el-input__wrapper) {
          border-radius: 20px;
          background: var(--bg-primary);
          
          .el-input__inner {
            color: var(--text-primary);
          }
        }
      }
      
      .el-button {
        height: 40px;
        padding: 0 20px;
        border-radius: 20px;
        font-weight: 500;
        
        :deep(.el-icon) {
          margin-right: 6px;
          font-size: 16px;
        }
      }
    }
  }
}
</style>

<template>
  <div class="chat-room-view">
    <el-container>
      <!-- 左侧好友列表 -->
      <el-aside width="280px">
        <div class="chat-tabs">
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
            <div 
              v-for="friend in friendsList" 
              :key="friend.username"
              :class="['user-item', { active: selectedUser?.username === friend.username }]"
              @click="selectUser(friend)"
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
                <div class="message-content">{{ msg.message }}</div>
                <div class="message-time">{{ formatMessageTime(msg.timestamp) }}</div>
              </div>
              <el-empty v-if="chatMessages.length === 0" description="暂无聊天记录" />
            </template>
            <el-empty v-else description="选择一个用户开始聊天" />
          </div>
          
          <div class="chat-input">
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
import { Search, Star, Promotion } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 状态
const activeTab = ref('friends')
const searchQuery = ref('')
const selectedUser = ref(null)
const inputMessage = ref('')
const friendsList = ref([])
const allUsersList = ref([])
const friendRequests = ref([])
const chatMessages = ref([])

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

const selectUser = async (user) => {
  selectedUser.value = user
  await loadChatMessages()
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

const sendMessage = async () => {
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

onMounted(() => {
  loadFriendsList()
  loadAllUsers()
  loadFriendRequests()
})
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

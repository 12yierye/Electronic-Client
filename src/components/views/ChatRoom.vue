<template>
  <div class="chat-room-view">
    <el-container>
      <!-- 左侧好友列表 -->
      <el-aside width="280px">
        <div class="chat-tabs">
          <!-- 聊天模式切换 -->
          <div class="mode-switch-row">
            <el-radio-group v-model="chatMode" size="small" @change="handleChatModeChange">
              <el-radio-button label="public">公网</el-radio-button>
              <el-radio-button v-if="useLanChat" label="lan">内网</el-radio-button>
            </el-radio-group>
          </div>

          <el-radio-group v-model="activeTab" size="small">
            <!-- 公网模式显示：好友、添加好友、申请 -->
            <template v-if="chatMode === 'public'">
              <el-radio-button label="friends">好友</el-radio-button>
              <el-radio-button label="add">添加好友</el-radio-button>
              <el-radio-button label="requests">申请</el-radio-button>
            </template>
            <!-- 内网模式显示：用户、群聊 -->
            <template v-else>
              <el-radio-button label="users">用户</el-radio-button>
              <el-radio-button label="groups">群聊</el-radio-button>
            </template>
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
          <!-- 公网：好友列表 -->
          <template v-if="chatMode === 'public' && activeTab === 'friends'">
            <div 
              v-for="friend in friendsList" 
              :key="friend.username"
              :class="['user-item', { active: selectedUser?.username === friend.username }]"
              @click="selectUser(friend, 'public')"
            >
              <el-avatar :size="40">{{ friend.username.charAt(0).toUpperCase() }}</el-avatar>
              <div class="user-info">
                <div class="user-name">{{ friend.username }}</div>
                <div class="user-role">
                  <span v-if="friend.online" class="online-status">在线</span>
                  <span v-else>离线</span>
                </div>
              </div>
              <el-icon 
                v-if="friend.starred" 
                class="star-icon starred"
              ><Star /></el-icon>
            </div>
            <el-empty v-if="friendsList.length === 0" description="暂无好友" />
          </template>
          
          <!-- 内网：用户列表 -->
          <template v-else-if="chatMode === 'lan' && activeTab === 'users'">
            <div 
              v-for="user in lanFriendsList" 
              :key="user.username"
              :class="['user-item', { active: selectedUser?.username === user.username }]"
              @click="selectUser(user, 'lan')"
            >
              <el-avatar :size="40">{{ user.username.charAt(0).toUpperCase() }}</el-avatar>
              <div class="user-info">
                <div class="user-name">{{ user.username }}</div>
                <div class="user-role">
                  <span v-if="user.online" class="online-status">在线</span>
                  <span v-else>离线</span>
                </div>
              </div>
            </div>
            <el-empty v-if="lanFriendsList.length === 0" description="内网中暂无用户" />
          </template>
          
          <!-- 内网：群聊列表 -->
          <template v-else-if="chatMode === 'lan' && activeTab === 'groups'">
            <div class="group-actions">
              <el-button type="primary" size="small" @click="showCreateGroupDialog = true">
                创建群聊
              </el-button>
            </div>
            <div
              v-for="group in filteredLanGroupsList"
              :key="group.id"
              :class="['user-item', { active: selectedGroup?.id === group.id }]"
              @click="selectGroup(group)"
            >
              <el-avatar :size="40" style="background: var(--accent-color)">
                <el-icon><ChatDotRound /></el-icon>
              </el-avatar>
              <div class="user-info">
                <div class="user-name">{{ group.name }}</div>
                <div class="user-role">{{ group.members.length }} 人</div>
              </div>
            </div>
            <el-empty v-if="filteredLanGroupsList.length === 0" description="暂无群聊" />
          </template>
          
          <!-- 公网：添加好友 -->
          <template v-else-if="chatMode === 'public' && activeTab === 'add'">
            <div v-if="!searchQuery" class="recommended-tip">
              猜你想加
              <el-button size="small" text @click="showRecommended = !showRecommended">
                {{ showRecommended ? '收起' : '显示' }}
              </el-button>
            </div>
            <div 
              v-for="user in showRecommended ? filteredUsers : []" 
              v-show="showRecommended || searchQuery"
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
            <el-empty v-if="filteredUsers.length === 0 && (showRecommended || searchQuery)" description="未找到用户" />
          </template>
          
          <!-- 公网：好友申请 -->
          <template v-else-if="chatMode === 'public' && activeTab === 'requests'">
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
            <span v-if="selectedGroup">{{ selectedGroup.name }}</span>
            <span v-else-if="selectedUser">{{ selectedUser.username }}</span>
            <span v-else class="placeholder">选择一个用户或群聊开始聊天</span>
            <!-- 群聊操作按钮 -->
            <div v-if="selectedGroup" class="group-actions">
              <el-button
                v-if="selectedGroup.creator === currentUsername"
                type="danger"
                size="small"
                @click="handleDisbandGroup"
              >
                解散群聊
              </el-button>
              <el-button
                size="small"
                @click="handleDeleteGroup"
              >
                删除聊天
              </el-button>
            </div>
          </div>
          
          <div class="chat-messages" ref="chatMessagesRef">
            <template v-if="selectedUser || selectedGroup">
              <div 
                v-for="msg in chatMessages" 
                :key="msg.id"
                :class="['chat-message', msg.from === currentUsername ? 'sent' : 'received']"
              >
                <!-- 群聊显示发送者 -->
                <div v-if="selectedGroup && msg.from !== currentUsername" class="message-sender">
                  {{ msg.from }}
                </div>
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
            <el-empty v-else description="选择一个用户或群聊开始聊天" />
          </div>
          
          <div class="chat-input">
            <!-- 图片上传按钮（仅私聊时显示） -->
            <el-upload
              v-if="selectedUser && !selectedGroup"
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
              :disabled="!selectedUser && !selectedGroup"
              @keydown.enter.exact="handleSendMessage"
            />
            <el-button 
              type="primary" 
              :icon="Promotion" 
              :disabled="(!selectedUser && !selectedGroup) || !inputMessage.trim()"
              @click="handleSendMessage"
            />
          </div>
        </div>
      </el-main>
    </el-container>
    
    <!-- 创建群聊对话框 -->
    <el-dialog
      v-model="showCreateGroupDialog"
      title="创建群聊"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="群名称">
          <el-input v-model="newGroupName" placeholder="请输入群名称" />
        </el-form-item>
        <el-form-item label="群成员">
          <el-select
            v-model="newGroupMembers"
            multiple
            placeholder="选择群成员"
            style="width: 100%"
          >
            <el-option
              v-for="user in lanFriendsList"
              :key="user.username"
              :label="user.username"
              :value="user.username"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateGroupDialog = false">取消</el-button>
        <el-button type="primary" @click="createGroup">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Search, Star, Promotion, Picture, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { matchByPinyin } from '../../utils/pinyin'

// 状态
const activeTab = ref('friends')
const chatMode = ref('public')  // 'public' 或 'lan'
const useLanChat = ref(false)
const lanSettings = ref({ useLanChat: false, lanServerIP: '', lanServerPort: '3001' })
const searchQuery = ref('')
const selectedUser = ref(null)
const selectedGroup = ref(null)  // 选中的群聊
const inputMessage = ref('')
const friendsList = ref([])
const allUsersList = ref([])
const friendRequests = ref([])
const chatMessages = ref([])
const lanFriendsList = ref([])  // 内网用户列表
const lanGroupsList = ref([])   // 内网群聊列表
const showCreateGroupDialog = ref(false)  // 创建群聊对话框
const newGroupName = ref('')    // 新群名称
const newGroupMembers = ref([]) // 新群成员
const deletedGroupIds = ref([]) // 用户删除的群聊ID列表
const showRecommended = ref(true) // 显示推荐好友
const enablePinyinSearch = ref(false) // 是否启用拼音搜索

// 计算属性
const currentUsername = computed(() => {
  const user = localStorage.getItem('userInfo')
  return user ? JSON.parse(user).username : ''
})

const filteredUsers = computed(() => {
  // 排除当前用户
  const users = allUsersList.value.filter(u => u.username !== currentUsername.value)
  
  // 如果没有搜索查询，显示推荐的10个随机用户（猜你想加）
  if (!searchQuery.value) {
    // 排除已经是好友的用户
    const friendUsernames = friendsList.value.map(f => f.username)
    const nonFriends = users.filter(u => !friendUsernames.includes(u.username))
    
    // 随机打乱并取前10个
    const shuffled = [...nonFriends].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 10)
  }
  
  // 有搜索查询时进行搜索
  const query = searchQuery.value.toLowerCase()
  return users.filter(u => {
    const username = u.username.toLowerCase()
    const email = u.email?.toLowerCase() || ''
    
    // 直接匹配
    if (username.includes(query) || email.includes(query)) {
      return true
    }
    
    // 拼音匹配（如果启用）
    if (enablePinyinSearch.value) {
      return matchByPinyin(u.username, query)
    }
    
    return false
  })
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

// 消息轮询
let messagePollingInterval = null
const POLLING_INTERVAL = 2000 // 每2秒检查一次新消息

// 轮询检查新消息
const pollForNewMessages = async () => {
  try {
    // 1. 刷新群聊列表（始终刷新，以便看到新创建的群聊）
    if (useLanChat.value && lanSettings.value.useLanChat && lanSettings.value.lanServerIP) {
      await loadLanGroupsList()
    }

    // 2. 如果选中了聊天对象，刷新消息
    if (selectedGroup.value) {
      // 群聊消息
      await loadGroupMessages()
    } else if (selectedUser.value) {
      // 私聊消息
      if (selectedUser.value.chatMode === 'lan') {
        await loadLanChatMessages()
      } else {
        await loadChatMessages()
      }
    }
  } catch (error) {
    // 忽略轮询错误
  }
}

// 启动消息轮询
const startMessagePolling = () => {
  if (messagePollingInterval) return
  messagePollingInterval = setInterval(pollForNewMessages, POLLING_INTERVAL)
  console.log('[ChatRoom] 消息轮询已启动')
}

// 停止消息轮询
const stopMessagePolling = () => {
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval)
    messagePollingInterval = null
    console.log('[ChatRoom] 消息轮询已停止')
  }
}

// 初始化
onMounted(() => {
  // 加载内网设置
  const savedLanSettings = localStorage.getItem('lanChatSettings')
  if (savedLanSettings) {
    lanSettings.value = JSON.parse(savedLanSettings)
    useLanChat.value = lanSettings.value.useLanChat
    enablePinyinSearch.value = lanSettings.value.enablePinyinSearch || false
  }

  // 加载已删除的群聊ID
  const savedDeletedGroups = localStorage.getItem('deletedGroupIds')
  if (savedDeletedGroups) {
    deletedGroupIds.value = JSON.parse(savedDeletedGroups)
  }

  loadFriendsList()
  loadAllUsers()
  loadFriendRequests()

  // 如果启用了内网聊天，加载内网好友
  if (useLanChat.value) {
    loadLanFriendsList()
  }

  // 启动消息轮询
  startMessagePolling()
})

// 组件卸载时停止轮询
onUnmounted(() => {
  stopMessagePolling()
})

// 切换聊天模式
const handleChatModeChange = async (mode) => {
  chatMessages.value = []
  selectedUser.value = null
  selectedGroup.value = null
  
  if (mode === 'lan') {
    // 切换到内网聊天
    activeTab.value = 'users'
    await loadLanFriendsList()
    await loadLanGroupsList()
  } else {
    // 切换到公网聊天
    activeTab.value = 'friends'
    await loadFriendsList()
  }
}

// 加载内网用户列表
const loadLanFriendsList = async () => {
  if (!lanSettings.value.useLanChat || !lanSettings.value.lanServerIP) return
  
  try {
    const response = await fetch(
      `http://${lanSettings.value.lanServerIP}:${lanSettings.value.lanServerPort}/api/friends?username=${encodeURIComponent(currentUsername.value)}`,
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
    console.error('加载内网用户失败:', error)
  }
}

// 加载内网群聊列表
const loadLanGroupsList = async () => {
  if (!lanSettings.value.useLanChat || !lanSettings.value.lanServerIP) return
  
  try {
    const response = await fetch(
      `http://${lanSettings.value.lanServerIP}:${lanSettings.value.lanServerPort}/api/groups?username=${encodeURIComponent(currentUsername.value)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    )
    const data = await response.json()
    if (data.success) {
      lanGroupsList.value = data.groups || []
    }
  } catch (error) {
    console.error('加载内网群聊失败:', error)
  }
}

// 选择群聊
const selectGroup = async (group) => {
  selectedGroup.value = group
  selectedUser.value = null
  await loadGroupMessages()
}

// 加载群聊消息
const loadGroupMessages = async () => {
  if (!selectedGroup.value || !lanSettings.value.useLanChat) return

  // 检查是否已从列表中隐藏，如果是则重新显示
  const groupId = selectedGroup.value.id
  if (deletedGroupIds.value.includes(groupId)) {
    deletedGroupIds.value = deletedGroupIds.value.filter(id => id !== groupId)
    localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
  }

  try {
    const response = await fetch(
      `http://${lanSettings.value.lanServerIP}:${lanSettings.value.lanServerPort}/api/group-messages?groupId=${encodeURIComponent(selectedGroup.value.id)}`,
      { method: 'GET' }
    )
    const data = await response.json()
    if (data.success) {
      chatMessages.value = data.messages || []
    }
  } catch (error) {
    console.error('加载群聊消息失败:', error)
  }
}

// 发送群聊消息
const sendGroupMessage = async () => {
  const message = inputMessage.value.trim()
  if (!message || !selectedGroup.value || !lanSettings.value.useLanChat) return

  // 检查是否已从列表中隐藏，如果是则重新显示
  const groupId = selectedGroup.value.id
  if (deletedGroupIds.value.includes(groupId)) {
    deletedGroupIds.value = deletedGroupIds.value.filter(id => id !== groupId)
    localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
  }

  try {
    const response = await fetch(
      `http://${lanSettings.value.lanServerIP}:${lanSettings.value.lanServerPort}/api/group-messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.value.id,
          from: currentUsername.value,
          message: message,
          type: 'text'
        })
      }
    )
    const data = await response.json()
    if (data.success) {
      chatMessages.value.push(data.data)
      inputMessage.value = ''
    }
  } catch (error) {
    console.error('发送群聊消息失败:', error)
    ElMessage.error('发送失败')
  }
}

// 创建群聊
const createGroup = async () => {
  if (!newGroupName.value.trim()) {
    ElMessage.warning('请输入群名称')
    return
  }
  
  try {
    const response = await fetch(
      `http://${lanSettings.value.lanServerIP}:${lanSettings.value.lanServerPort}/api/groups`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.value.trim(),
          creator: currentUsername.value,
          members: newGroupMembers.value
        })
      }
    )
    const data = await response.json()
    if (data.success) {
      ElMessage.success('群聊创建成功')
      showCreateGroupDialog.value = false
      newGroupName.value = ''
      newGroupMembers.value = []
      await loadLanGroupsList()
    } else {
      ElMessage.error(data.message || '创建失败')
    }
  } catch (error) {
    console.error('创建群聊失败:', error)
    ElMessage.error('创建失败')
  }
}

// 发送消息（根据当前选择判断是私聊还是群聊）
const handleSendMessage = () => {
  if (selectedGroup.value) {
    sendGroupMessage()
  } else if (selectedUser.value?.chatMode === 'lan') {
    sendLanMessage()
  } else {
    sendMessage()
  }
}

// 删除群聊（本地隐藏，有新消息时重新显示）
const handleDeleteGroup = () => {
  if (!selectedGroup.value) return

  const groupId = selectedGroup.value.id
  // 添加到已删除列表
  if (!deletedGroupIds.value.includes(groupId)) {
    deletedGroupIds.value.push(groupId)
    localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
  }

  // 清除选中状态
  selectedGroup.value = null
  chatMessages.value = []

  // 刷新群聊列表（会自动过滤已删除的）
  loadLanGroupsList()

  ElMessage.success('群聊已隐藏')
}

// 解散群聊（仅创建者可见）
const handleDisbandGroup = async () => {
  if (!selectedGroup.value) return

  try {
    const response = await fetch(
      `http://${lanSettings.value.lanServerIP}:${lanSettings.value.lanServerPort}/api/groups/${selectedGroup.value.id}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername.value })
      }
    )
    const data = await response.json()
    if (data.success) {
      ElMessage.success('群聊已解散')

      // 从已删除列表中移除（如果存在）
      const groupId = selectedGroup.value.id
      deletedGroupIds.value = deletedGroupIds.value.filter(id => id !== groupId)
      localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))

      // 清除选中状态
      selectedGroup.value = null
      chatMessages.value = []

      // 刷新群聊列表
      await loadLanGroupsList()
    } else {
      ElMessage.error(data.message || '解散失败')
    }
  } catch (error) {
    console.error('解散群聊失败:', error)
    ElMessage.error('解散群聊失败')
  }
}

// 过滤群聊列表（排除已删除的）
const filteredLanGroupsList = computed(() => {
  return lanGroupsList.value.filter(group => !deletedGroupIds.value.includes(group.id))
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

    .mode-switch-row {
      margin-bottom: 10px;
    }
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
      display: flex;
      align-items: center;
      justify-content: space-between;

      .placeholder {
        color: var(--text-secondary);
      }

      .group-actions {
        display: flex;
        gap: 8px;
      }
    }
    
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      
      .chat-message {
        margin-bottom: 15px;
        max-width: 70%;
        width: fit-content;
        
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
          min-width: 60px;
          
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
        
        .message-sender {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 3px;
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

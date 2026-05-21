import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { matchByPinyin } from '../utils/pinyin'

export function useChatRoom() {
  const activeTab = ref('friends')
  const chatMode = ref('public')
  const lanSettings = ref({ serverIP: '', serverPort: '3000' })
  const useLanChat = computed(() => !!lanSettings.value.serverIP)
  const searchQuery = ref('')
  const selectedUser = ref(null)
  const selectedGroup = ref(null)
  const inputMessage = ref('')
  const friendsList = ref([])
  const allUsersList = ref([])
  const friendRequests = ref([])
  const chatMessages = ref([])
  const lanFriendsList = ref([])
  const lanGroupsList = ref([])
  const showCreateGroupDialog = ref(false)
  const newGroupName = ref('')
  const newGroupMembers = ref([])
  const deletedGroupIds = ref([])
  const showRecommended = ref(true)
  const enablePinyinSearch = ref(false)

  const currentUsername = computed(() => {
    const user = localStorage.getItem('userInfo')
    return user ? JSON.parse(user).username : ''
  })

  const filteredUsers = computed(() => {
    const users = allUsersList.value.filter(u => u.username !== currentUsername.value)
    if (!searchQuery.value) {
      const friendUsernames = friendsList.value.map(f => f.username)
      const nonFriends = users.filter(u => !friendUsernames.includes(u.username))
      const shuffled = [...nonFriends].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, 10)
    }
    const query = searchQuery.value.toLowerCase()
    return users.filter(u => {
      const username = u.username.toLowerCase()
      const email = u.email?.toLowerCase() || ''
      if (username.includes(query) || email.includes(query)) return true
      if (enablePinyinSearch.value) return matchByPinyin(u.username, query)
      return false
    })
  })

  const filteredLanGroupsList = computed(() => {
    return lanGroupsList.value.filter(group => !deletedGroupIds.value.includes(group.id))
  })

  const normalizeMessage = (msg) => {
    if (!msg) return msg
    if (!msg.from && msg.sender) msg.from = msg.sender
    if (!msg.message && msg.content) msg.message = msg.content
    return msg
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('zh-CN')
  }

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  const isImageMessage = (message) => {
    if (!message) return false
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    const lowerMessage = message.toLowerCase()
    if (lowerMessage.startsWith('http://') || lowerMessage.startsWith('https://')) {
      return imageExtensions.some(ext => lowerMessage.includes(ext)) ||
             lowerMessage.includes('image') || lowerMessage.includes('photo') || lowerMessage.includes('img')
    }
    if (lowerMessage.startsWith('data:image/')) return true
    return false
  }

  const onImageLoad = () => {}

  const loadFriendsList = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.getFriendsList(currentUsername.value)
      if (result.success) friendsList.value = result.friends || []
    }
  }

  const loadAllUsers = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.getUserList()
      if (result.success) allUsersList.value = result.users || []
    }
  }

  const loadFriendRequests = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.getFriendRequests(currentUsername.value, 'received')
      if (result.success) friendRequests.value = result.requests || []
    }
  }

  const selectUser = async (user, mode = chatMode.value) => {
    selectedUser.value = { ...user, chatMode: mode }
    if (mode === 'lan') await loadLanChatMessages()
    else await loadChatMessages()
  }

  const loadChatMessages = async (append = false) => {
    if (!selectedUser.value || !window.electronAPI) return
    const result = await window.electronAPI.getChatMessages(
      currentUsername.value, selectedUser.value.username
    )
    if (result.success) {
      const newMessages = (result.messages || []).map(normalizeMessage)
      if (append) {
        const existingIds = new Set(chatMessages.value.map(m => m.id))
        const uniqueNewMessages = newMessages.filter(m => m.id && !existingIds.has(m.id))
        chatMessages.value = [...chatMessages.value, ...uniqueNewMessages]
      } else {
        chatMessages.value = newMessages
      }
    }
  }

  const loadLanChatMessages = async (append = false) => {
    if (!selectedUser.value || !lanSettings.value.serverIP) return
    try {
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/messages?from=${encodeURIComponent(currentUsername.value)}&to=${encodeURIComponent(selectedUser.value.username)}`,
        { method: 'GET' }
      )
      const data = await response.json()
      if (data.success) {
        const newMessages = (data.messages || []).map(normalizeMessage)
        if (append) {
          const existingIds = new Set(chatMessages.value.map(m => m.id))
          const uniqueNewMessages = newMessages.filter(m => m.id && !existingIds.has(m.id))
          chatMessages.value = [...chatMessages.value, ...uniqueNewMessages]
        } else {
          chatMessages.value = newMessages
        }
      }
    } catch (error) {
      console.error('[Chat] load LAN msgs failed:', error)
    }
  }

  const sendLanMessage = async () => {
    const message = inputMessage.value.trim()
    if (!message || !selectedUser.value || !lanSettings.value.serverIP) return
    try {
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: currentUsername.value, to: selectedUser.value.username,
            message: message, timestamp: new Date().toISOString()
          })
        }
      )
      const data = await response.json()
      if (data.success) {
        chatMessages.value.push(normalizeMessage(data.message))
        inputMessage.value = ''
      }
    } catch (error) {
      console.error('[Chat] send LAN msg failed:', error)
      ElMessage.error('发送失败: ' + error.message)
    }
  }

  const sendMessage = async () => {
    if (selectedUser.value?.chatMode === 'lan') {
      await sendLanMessage()
      return
    }
    const message = inputMessage.value.trim()
    if (!message || !selectedUser.value || !window.electronAPI) return
    const result = await window.electronAPI.sendChatMessage({
      sender: currentUsername.value, receiver: selectedUser.value.username,
      message, timestamp: new Date().toISOString()
    })
    if (result.success) {
      chatMessages.value.push(normalizeMessage(result.data))
      inputMessage.value = ''
    }
  }

  const handleImageSelect = async (file) => {
    if (!selectedUser.value || !window.electronAPI) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const result = await window.electronAPI.sendChatMessage({
        sender: currentUsername.value, receiver: selectedUser.value.username,
        message: e.target.result, messageType: 'image',
        timestamp: new Date().toISOString()
      })
      if (result.success) chatMessages.value.push(normalizeMessage(result.data))
    }
    reader.readAsDataURL(file.raw)
  }

  const handleAddFriend = async (user) => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.sendFriendRequest(currentUsername.value, user.username)
    if (result.success) {
      ElMessage.success('好友申请已发送')
    } else {
      const errorMessage = result.message || '添加失败'
      if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        const isLanFriend = lanFriendsList.value.some(u => u.username === user.username)
        if (isLanFriend) ElMessage.info('对方已在您的内网好友列表中，可以直接聊天')
        else ElMessage.error(errorMessage)
      } else {
        ElMessage.error(errorMessage)
      }
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

  const handleSearch = (query) => {}

  const loadLanFriendsList = async () => {
    if (!lanSettings.value.serverIP) return
    try {
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/friends?username=${encodeURIComponent(currentUsername.value)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      )
      const data = await response.json()
      if (data.success) lanFriendsList.value = data.friends || []
    } catch (error) {
      console.error('[Chat] load LAN users failed:', error)
    }
  }

  const loadLanGroupsList = async () => {
    if (!lanSettings.value.serverIP) return
    try {
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/groups?username=${encodeURIComponent(currentUsername.value)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      )
      const data = await response.json()
      if (data.success) lanGroupsList.value = data.groups || []
    } catch (error) {
      console.error('[Chat] load LAN groups failed:', error)
    }
  }

  const selectGroup = async (group) => {
    selectedGroup.value = group
    selectedUser.value = null
    await loadGroupMessages()
  }

  const loadGroupMessages = async (append = false) => {
    if (!selectedGroup.value || !lanSettings.value.serverIP) return
    const groupId = selectedGroup.value.id
    if (deletedGroupIds.value.includes(groupId)) {
      deletedGroupIds.value = deletedGroupIds.value.filter(id => id !== groupId)
      localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
    }
    try {
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/group-messages?groupId=${encodeURIComponent(selectedGroup.value.id)}`,
        { method: 'GET' }
      )
      const data = await response.json()
      if (data.success) {
        const newMessages = (data.messages || []).map(normalizeMessage)
        if (append) {
          const existingIds = new Set(chatMessages.value.map(m => m.id))
          const uniqueNewMessages = newMessages.filter(m => m.id && !existingIds.has(m.id))
          chatMessages.value = [...chatMessages.value, ...uniqueNewMessages]
        } else {
          chatMessages.value = newMessages
        }
      }
    } catch (error) {
      console.error('[Chat] load group msgs failed:', error)
    }
  }

  const sendGroupMessage = async () => {
    const message = inputMessage.value.trim()
    if (!message || !selectedGroup.value || !lanSettings.value.serverIP) return
    const groupId = selectedGroup.value.id
    if (deletedGroupIds.value.includes(groupId)) {
      deletedGroupIds.value = deletedGroupIds.value.filter(id => id !== groupId)
      localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
    }
    try {
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/group-messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: selectedGroup.value.id, from: currentUsername.value, message, type: 'text' })
        }
      )
      const data = await response.json()
      if (data.success) {
        chatMessages.value.push(data.data)
        inputMessage.value = ''
      }
    } catch (error) {
      console.error('[Chat] send group msg failed:', error)
      ElMessage.error('发送失败')
    }
  }

  const createGroup = async () => {
    if (!newGroupName.value.trim()) {
      ElMessage.warning('请输入群名称')
      return
    }
    try {
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/groups`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newGroupName.value.trim(), creator: currentUsername.value, members: newGroupMembers.value })
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
      console.error('[Chat] create group failed:', error)
      ElMessage.error('创建失败')
    }
  }

  const handleSendMessage = () => {
    if (selectedGroup.value) sendGroupMessage()
    else if (selectedUser.value?.chatMode === 'lan') sendLanMessage()
    else sendMessage()
  }

  const handleDeleteGroup = () => {
    if (!selectedGroup.value) return
    const groupId = selectedGroup.value.id
    if (!deletedGroupIds.value.includes(groupId)) {
      deletedGroupIds.value.push(groupId)
      localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
    }
    selectedGroup.value = null
    chatMessages.value = []
    loadLanGroupsList()
    ElMessage.success('群聊已隐藏')
  }

  const handleDisbandGroup = async () => {
    if (!selectedGroup.value) return
    try {
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/groups/${selectedGroup.value.id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUsername.value })
        }
      )
      const data = await response.json()
      if (data.success) {
        ElMessage.success('群聊已解散')
        const groupId = selectedGroup.value.id
        deletedGroupIds.value = deletedGroupIds.value.filter(id => id !== groupId)
        localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
        selectedGroup.value = null
        chatMessages.value = []
        await loadLanGroupsList()
      } else {
        ElMessage.error(data.message || '解散失败')
      }
    } catch (error) {
      console.error('[Chat] disband group failed:', error)
      ElMessage.error('解散群聊失败')
    }
  }

  const handleChatModeChange = async (mode) => {
    chatMessages.value = []
    selectedUser.value = null
    selectedGroup.value = null
    if (mode === 'lan') {
      activeTab.value = 'users'
      await loadLanFriendsList()
      await loadLanGroupsList()
    } else {
      activeTab.value = 'friends'
      await loadFriendsList()
    }
  }

  let messagePollingInterval = null
  const POLLING_INTERVAL = 2000

  const pollForNewMessages = async () => {
    try {
      if (lanSettings.value.serverIP) {
        await loadLanGroupsList()
      }
      if (selectedGroup.value) {
        await loadGroupMessages(true)
      } else if (selectedUser.value) {
        if (selectedUser.value.chatMode === 'lan') await loadLanChatMessages(true)
        else await loadChatMessages(true)
      }
    } catch (error) {}
  }

  const startMessagePolling = () => {
    if (messagePollingInterval) return
    messagePollingInterval = setInterval(pollForNewMessages, POLLING_INTERVAL)
    console.log('[Chat] polling started')
  }

  const stopMessagePolling = () => {
    if (messagePollingInterval) {
      clearInterval(messagePollingInterval)
      messagePollingInterval = null
      console.log('[Chat] polling stopped')
    }
  }

  onMounted(() => {
    const savedLanSettings = localStorage.getItem('lanChatSettings')
    if (savedLanSettings) {
      const settings = JSON.parse(savedLanSettings)
      lanSettings.value.serverIP = settings.serverIP || settings.lanServerIP || ''
      lanSettings.value.serverPort = settings.serverPort || settings.lanServerPort || '3000'
      enablePinyinSearch.value = settings.enablePinyinSearch || false
    }
    const savedDeletedGroups = localStorage.getItem('deletedGroupIds')
    if (savedDeletedGroups) {
      deletedGroupIds.value = JSON.parse(savedDeletedGroups)
    }
    loadFriendsList()
    loadAllUsers()
    loadFriendRequests()
    if (lanSettings.value.serverIP) loadLanFriendsList()
    startMessagePolling()
  })

  onUnmounted(() => {
    stopMessagePolling()
  })

  return {
    activeTab, chatMode, useLanChat, lanSettings, searchQuery,
    selectedUser, selectedGroup, inputMessage,
    friendsList, allUsersList, friendRequests, chatMessages,
    lanFriendsList, lanGroupsList,
    showCreateGroupDialog, newGroupName, newGroupMembers,
    deletedGroupIds, showRecommended, enablePinyinSearch,
    currentUsername, filteredUsers, filteredLanGroupsList,
    loadFriendsList, loadAllUsers, loadFriendRequests,
    selectUser, loadChatMessages, loadLanChatMessages,
    sendLanMessage, sendMessage, handleImageSelect,
    handleAddFriend, handleRequest, handleSearch,
    normalizeMessage, formatDate, formatMessageTime,
    isImageMessage, onImageLoad,
    startMessagePolling, stopMessagePolling,
    handleChatModeChange, loadLanFriendsList, loadLanGroupsList,
    selectGroup, loadGroupMessages, sendGroupMessage,
    createGroup, handleSendMessage, handleDeleteGroup, handleDisbandGroup,
    showRecommended
  }
}

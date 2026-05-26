import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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
  const searchResults = ref([])
  const publicGroupsList = ref([])
  const groupUnread = ref({})
  const pendingMessages = ref([])
  const SEND_TIMEOUT = 10000

  const pendingRequestsCount = computed(() => friendRequests.value.length)

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
    if (searchResults.value.length > 0) {
      return searchResults.value.filter(u => u.username !== currentUsername.value)
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
    let list = lanGroupsList.value.filter(group => !deletedGroupIds.value.includes(group.id) && group.networkType !== 'public')
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      list = list.filter(g => g.name.toLowerCase().includes(q))
    }
    return list
  })

  const filteredPublicGroupsList = computed(() => {
    let list = publicGroupsList.value.filter(group => !deletedGroupIds.value.includes(group.id) && group.networkType !== 'lan')
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      list = list.filter(g => g.name.toLowerCase().includes(q))
    }
    return list
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

  const isDocumentMessage = (msg) => {
    return msg && (msg.type === 'document' || msg.messageType === 'document')
  }

  const parseDocumentInfo = (message) => {
    try {
      return typeof message === 'string' ? JSON.parse(message) : message
    } catch {
      return null
    }
  }

  const onImageLoad = () => {}

  // 搜索用户（调用服务端 API）
  watch(searchQuery, async (query) => {
    if (!query.trim() || !window.electronAPI) {
      searchResults.value = []
      return
    }
    if (activeTab.value === 'add') {
      const result = await window.electronAPI.searchUsers(query.trim())
      if (result.success && result.users) {
        searchResults.value = result.users
      }
    } else {
      searchResults.value = []
    }
  })

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
      if (result.success) friendRequests.value = (result.requests || []).filter(r => r.status === 'pending')
    }
  }

  const selectUser = async (user, mode = chatMode.value) => {
    selectedUser.value = { ...user, chatMode: mode }
    selectedGroup.value = null
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

  const sendLanMessage = async (messageText, msgType = 'text') => {
    const message = messageText.trim()
    if (!message || !selectedUser.value || !lanSettings.value.serverIP) return
    const tempId = 'pending_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    const tempMsg = {
      id: tempId, from: currentUsername.value, to: selectedUser.value.username,
      message, type: msgType, timestamp: new Date().toISOString(), _pending: true
    }
    chatMessages.value = [...chatMessages.value, tempMsg]
    let resolved = false
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        updateMessageStatus(tempId, false)
      }
    }, SEND_TIMEOUT)
    try {
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: currentUsername.value, to: selectedUser.value.username,
            message, timestamp: new Date().toISOString()
          })
        }
      )
      clearTimeout(timeoutId)
      if (!resolved) {
        resolved = true
        const data = await response.json()
        if (data.success) {
          updateMessageStatus(tempId, true, data.message?.id || data.data?.id)
        } else {
          updateMessageStatus(tempId, false)
        }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if (!resolved) {
        resolved = true
        updateMessageStatus(tempId, false)
      }
    }
  }

  const sendMessage = async (messageText, msgType = 'text') => {
    if (selectedUser.value?.chatMode === 'lan') {
      await sendLanMessage(messageText, msgType)
      return
    }
    const message = messageText.trim()
    if (!message || !selectedUser.value || !window.electronAPI) return
    const tempId = 'pending_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    const tempMsg = {
      id: tempId, from: currentUsername.value, to: selectedUser.value.username,
      message, type: msgType, timestamp: new Date().toISOString(), _pending: true
    }
    chatMessages.value = [...chatMessages.value, tempMsg]
    let resolved = false
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        updateMessageStatus(tempId, false)
      }
    }, SEND_TIMEOUT)
    try {
      const result = await window.electronAPI.sendChatMessage({
        sender: currentUsername.value, receiver: selectedUser.value.username,
        message, messageType: msgType, timestamp: new Date().toISOString()
      })
      clearTimeout(timeoutId)
      if (!resolved) {
        resolved = true
        if (result.success) {
          updateMessageStatus(tempId, true, result.data?.id)
        } else {
          updateMessageStatus(tempId, false)
        }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if (!resolved) {
        resolved = true
        updateMessageStatus(tempId, false)
      }
    }
  }

  const updateMessageStatus = (tempId, success, realId) => {
    const idx = chatMessages.value.findIndex(m => m.id === tempId)
    if (idx === -1) return
    if (success) {
      const updated = { ...chatMessages.value[idx], _pending: false, _failed: false }
      if (realId) updated.id = realId
      chatMessages.value[idx] = updated
      ElMessage.success('发送成功')
    } else {
      chatMessages.value[idx] = { ...chatMessages.value[idx], _pending: false, _failed: true }
    }
  }

  const retryMessage = async (msg) => {
    if (!msg._failed) return
    const idx = chatMessages.value.findIndex(m => m.id === msg.id)
    if (idx === -1) return
    chatMessages.value.splice(idx, 1)
    if (selectedGroup.value) {
      inputMessage.value = msg.message
      await sendGroupMessage(msg.message, msg.type || 'text')
    } else {
      inputMessage.value = msg.message
      await (selectedUser.value?.chatMode === 'lan'
        ? sendLanMessage(msg.message, msg.type || 'text')
        : sendMessage(msg.message, msg.type || 'text'))
    }
    inputMessage.value = ''
  }

  const handleImageSelect = async (file) => {
    if (!selectedUser.value || !window.electronAPI) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      await sendMessage(e.target.result, 'image')
    }
    reader.readAsDataURL(file.raw)
  }

  const handleGroupImageSelect = async (file) => {
    if (!selectedGroup.value) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      await sendGroupMessage(e.target.result, 'image')
    }
    reader.readAsDataURL(file.raw)
  }

  const handleSelectImage = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.selectImageFile()
    if (!result.success) return
    if (selectedGroup.value) {
      await sendGroupMessage(result.data, 'image')
    } else if (selectedUser.value) {
      if (selectedUser.value.chatMode === 'lan') await sendLanMessage(result.data, 'image')
      else await sendMessage(result.data, 'image')
    }
  }

  const handleSelectDocument = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.selectDocumentFile()
    if (!result.success) return
    const docInfo = JSON.stringify({ name: result.name, ext: result.ext, data: result.data })
    if (selectedGroup.value) {
      await sendGroupMessage(docInfo, 'document')
    } else if (selectedUser.value) {
      if (selectedUser.value.chatMode === 'lan') await sendLanMessage(docInfo, 'document')
      else await sendMessage(docInfo, 'document')
    }
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

  const loadPublicGroupsList = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.getGroups(currentUsername.value)
    if (result.success) publicGroupsList.value = result.groups || []
  }

  const getGroupDND = (groupId) => {
    const username = currentUsername.value
    if (!username || !groupId) return false
    return localStorage.getItem(`groupDND_${username}_${groupId}`) === '1'
  }

  const clearGroupUnread = (groupId) => {
    const username = currentUsername.value
    if (!username || !groupId) return
    groupUnread.value = { ...groupUnread.value, [groupId]: 0 }
    localStorage.setItem(`groupUnread_${username}_${groupId}`, '0')
  }

  const selectGroup = async (group) => {
    selectedGroup.value = group
    selectedUser.value = null
    if (group?.id) clearGroupUnread(group.id)
    await loadGroupMessages()
  }

  const loadGroupMessages = async (append = false) => {
    if (!selectedGroup.value) return
    const groupId = selectedGroup.value.id
    if (deletedGroupIds.value.includes(groupId)) {
      deletedGroupIds.value = deletedGroupIds.value.filter(id => id !== groupId)
      localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
    }
    let data
    if (chatMode.value === 'lan') {
      if (!lanSettings.value.serverIP) return
      const response = await fetch(
        `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/group-messages?groupId=${encodeURIComponent(groupId)}`,
        { method: 'GET' }
      )
      data = await response.json()
    } else if (window.electronAPI) {
      const result = await window.electronAPI.getGroupMessages(groupId)
      data = result
    } else {
      return
    }
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
  }

  const sendGroupMessage = async (messageText, msgType = 'text') => {
    const message = messageText.trim()
    if (!message || !selectedGroup.value) return
    const groupId = selectedGroup.value.id
    if (deletedGroupIds.value.includes(groupId)) {
      deletedGroupIds.value = deletedGroupIds.value.filter(id => id !== groupId)
      localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
    }
    const tempId = 'pending_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    const tempMsg = {
      id: tempId, from: currentUsername.value, groupId, message,
      type: msgType, timestamp: new Date().toISOString(), _pending: true
    }
    chatMessages.value = [...chatMessages.value, tempMsg]
    let resolved = false
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        updateMessageStatus(tempId, false)
      }
    }, SEND_TIMEOUT)
    let data
    if (chatMode.value === 'lan') {
      if (!lanSettings.value.serverIP) return
      try {
        const response = await fetch(
          `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/group-messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, from: currentUsername.value, message, type: msgType })
          }
        )
        clearTimeout(timeoutId)
        if (!resolved) {
          resolved = true
          data = await response.json()
          if (data.success) updateMessageStatus(tempId, true, data.data?.id)
          else updateMessageStatus(tempId, false)
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (!resolved) { resolved = true; updateMessageStatus(tempId, false) }
      }
    } else if (window.electronAPI) {
      try {
        const result = await window.electronAPI.sendGroupMessage(groupId, currentUsername.value, message, msgType)
        clearTimeout(timeoutId)
        if (!resolved) {
          resolved = true
          if (result.success) updateMessageStatus(tempId, true, result.data?.id)
          else updateMessageStatus(tempId, false)
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (!resolved) { resolved = true; updateMessageStatus(tempId, false) }
      }
    } else {
      clearTimeout(timeoutId)
      if (!resolved) { resolved = true; updateMessageStatus(tempId, false) }
    }
  }

  const createGroup = async () => {
    if (!newGroupName.value.trim()) {
      ElMessage.warning('请输入群名称')
      return
    }
    if (newGroupMembers.value.length < 2) {
      ElMessage.warning('至少添加 2 名成员')
      return
    }
    const groupData = { name: newGroupName.value.trim(), creator: currentUsername.value, members: [...newGroupMembers.value], networkType: chatMode.value }
    let data
    if (chatMode.value === 'lan') {
      if (!lanSettings.value.serverIP) {
        ElMessage.error('请先配置内网服务器地址')
        return
      }
      try {
        const response = await fetch(
          `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/groups`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groupData) }
        )
        data = await response.json()
      } catch (error) {
        console.error('[Chat] create group failed:', error)
        ElMessage.error('创建失败')
        return
      }
    } else if (window.electronAPI) {
      try {
        data = await window.electronAPI.createGroup(groupData)
      } catch (error) {
        console.error('[Chat] create group failed:', error)
        ElMessage.error('创建失败: ' + (error.message || '未知错误'))
        return
      }
    } else {
      return
    }
    if (data.success) {
      ElMessage.success('群聊创建成功')
      showCreateGroupDialog.value = false
      newGroupName.value = ''
      newGroupMembers.value = []
      if (chatMode.value === 'lan') await loadLanGroupsList()
      else await loadPublicGroupsList()
    } else {
      ElMessage.error(data.message || '创建失败')
    }
  }

  const handleSendMessage = () => {
    const msg = inputMessage.value.trim()
    if (!msg) return
    if (selectedGroup.value) sendGroupMessage(msg, 'text')
    else if (selectedUser.value?.chatMode === 'lan') sendLanMessage(msg, 'text')
    else sendMessage(msg, 'text')
    inputMessage.value = ''
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
    if (chatMode.value === 'lan') loadLanGroupsList()
    else loadPublicGroupsList()
    ElMessage.success('群聊已隐藏')
  }

  const handleDisbandGroup = async () => {
    if (!selectedGroup.value) return
    let data
    if (chatMode.value === 'lan') {
      if (!lanSettings.value.serverIP) {
        ElMessage.error('请先配置内网服务器地址')
        return
      }
      try {
        const response = await fetch(
          `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/groups/${selectedGroup.value.id}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername.value })
          }
        )
        data = await response.json()
      } catch (error) {
        console.error('[Chat] disband group failed:', error)
        ElMessage.error('解散群聊失败')
        return
      }
    } else if (window.electronAPI) {
      data = await window.electronAPI.disbandGroup(selectedGroup.value.id, currentUsername.value)
    } else {
      return
    }
    if (data.success) {
      ElMessage.success('群聊已解散')
      const groupId = selectedGroup.value.id
      deletedGroupIds.value = deletedGroupIds.value.filter(id => id !== groupId)
      localStorage.setItem('deletedGroupIds', JSON.stringify(deletedGroupIds.value))
      selectedGroup.value = null
      chatMessages.value = []
      if (chatMode.value === 'lan') await loadLanGroupsList()
      else await loadPublicGroupsList()
    } else {
      ElMessage.error(data.message || '解散失败')
    }
  }

  const handleChatModeChange = async (mode) => {
    chatMessages.value = []
    selectedUser.value = null
    selectedGroup.value = null
    inputMessage.value = ''
    reloadLanSettings()
    if (mode === 'lan') {
      activeTab.value = 'users'
      await loadLanFriendsList()
      await loadLanGroupsList()
    } else {
      activeTab.value = 'friends'
      await loadFriendsList()
      await loadPublicGroupsList()
    }
  }

  const reloadLanSettings = () => {
    const savedLanSettings = localStorage.getItem('lanChatSettings')
    if (savedLanSettings) {
      const settings = JSON.parse(savedLanSettings)
      lanSettings.value.serverIP = settings.serverIP || settings.lanServerIP || ''
      lanSettings.value.serverPort = settings.serverPort || settings.lanServerPort || '3000'
      enablePinyinSearch.value = settings.enablePinyinSearch || false
    } else {
      lanSettings.value.serverIP = ''
      lanSettings.value.serverPort = '3000'
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
    reloadLanSettings()
    const savedDeletedGroups = localStorage.getItem('deletedGroupIds')
    if (savedDeletedGroups) {
      deletedGroupIds.value = JSON.parse(savedDeletedGroups)
    }
    loadFriendsList()
    loadAllUsers()
    loadFriendRequests()
    loadPublicGroupsList()
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
    lanFriendsList, lanGroupsList, publicGroupsList,
    showCreateGroupDialog, newGroupName, newGroupMembers,
    deletedGroupIds, showRecommended, enablePinyinSearch,
    pendingRequestsCount,
    currentUsername, filteredUsers, filteredLanGroupsList, filteredPublicGroupsList,
    loadFriendsList, loadAllUsers, loadFriendRequests,
    selectUser, loadChatMessages, loadLanChatMessages,
    sendLanMessage, sendMessage, handleImageSelect, handleGroupImageSelect,
    handleSelectImage, handleSelectDocument,
    handleAddFriend, handleRequest,
    normalizeMessage, formatDate, formatMessageTime,
    isImageMessage, isDocumentMessage, parseDocumentInfo, onImageLoad, retryMessage,
    startMessagePolling, stopMessagePolling,
    handleChatModeChange, loadLanFriendsList, loadLanGroupsList,
    selectGroup, loadGroupMessages, sendGroupMessage,
    createGroup, handleSendMessage, handleDeleteGroup, handleDisbandGroup,
    loadPublicGroupsList, groupUnread, getGroupDND, clearGroupUnread
  }
}

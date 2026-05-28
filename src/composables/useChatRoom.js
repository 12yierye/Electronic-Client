import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { matchByPinyin } from '../utils/pinyin'
import { loadUsersAvatars } from './useAvatar'

export const chatTotalUnread = ref(0)
export const sharedUserUnread = ref({})
export const sharedGroupUnread = ref({})
// 每个会话的最后一条消息信息（用于排序）
export const sharedLastMsgMap = ref({})

export function refreshTotalUnread() {
    const user = localStorage.getItem('userInfo')
    if (!user) {
        chatTotalUnread.value = 0
        return
    }
    const username = JSON.parse(user).username
    let total = 0
    for (const [key, count] of Object.entries(sharedUserUnread.value)) {
        if (localStorage.getItem(`userDND_${username}_${key}`) !== '1') {
            total += typeof count === 'number' ? count : 0
        }
    }
    for (const [key, count] of Object.entries(sharedGroupUnread.value)) {
        if (localStorage.getItem(`groupDND_${username}_${key}`) !== '1') {
            total += typeof count === 'number' ? count : 0
        }
    }
    chatTotalUnread.value = total
}

// ====== Client-side Read Points (QQ-style read tracking) ======
function readPointsKey(username) { return 'chat_readPoints_' + username }

export function loadReadPoints(username) {
  if (!username) return {}
  try {
    const raw = localStorage.getItem(readPointsKey(username))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveReadPoints(username, points) {
  if (!username) return
  localStorage.setItem(readPointsKey(username), JSON.stringify(points))
}

const userConvKey = (target) => 'user:' + target
const groupConvKey = (groupId) => 'group:' + groupId

function compareIds(a, b) {
  const na = Number(a), nb = Number(b)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

function isNewerThan(msgId, lastReadId) {
  if (!lastReadId) return true
  return compareIds(msgId, lastReadId) > 0
}

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
  const groupUnread = sharedGroupUnread
  const userUnread = sharedUserUnread
  const pendingMessages = ref([])
  const readPoints = ref({})
  const SEND_TIMEOUT = 10000

  const getLastRealMsgId = () => {
    const realMsgs = chatMessages.value.filter(m => m.id && !String(m.id).startsWith('pending_'))
    if (!realMsgs.length) return null
    return realMsgs.reduce((max, m) => compareIds(max, m.id) >= 0 ? max : m.id, realMsgs[0].id)
  }

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
        loadUsersAvatars(searchResults.value.map(u => u.username))
      }
    } else {
      searchResults.value = []
    }
  })

  const loadFriendsList = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.getFriendsList(currentUsername.value)
      if (result.success) {
        friendsList.value = result.friends || []
        loadUsersAvatars(friendsList.value.map(f => f.username))
      }
    }
  }

  const loadAllUsers = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.getUserList()
      if (result.success) {
        allUsersList.value = result.users || []
        loadUsersAvatars(allUsersList.value.map(u => u.username))
      }
    }
  }

  const loadFriendRequests = async () => {
    if (window.electronAPI?.getFriendRequests) {
      try {
        const result = await window.electronAPI.getFriendRequests(currentUsername.value, 'received')
        if (result.success) {
          friendRequests.value = (result.requests || []).filter(r => r.status === 'pending')
          loadUsersAvatars(friendRequests.value.map(r => r.sender))
        }
      } catch (e) {
        console.error('[Chat] load friend requests failed:', e)
      }
    }
  }

  const selectUser = async (user, mode = chatMode.value) => {
    console.log('[DIAG-CLIENT] selectUser called with:', user?.username, 'stack:', new Error().stack)
    selectedUser.value = { ...user, chatMode: mode }
    selectedGroup.value = null
    // 不再立即清零未读 — 改由轮询在 readPoint 更新后自然归零
    // 这确保未读红点有足够时间渲染到屏幕上
    if (mode === 'lan') await loadLanChatMessages()
    else await loadChatMessages()
    if (user?.username) {
      const lastId = getLastRealMsgId()
      if (lastId) {
        const ck = userConvKey(user.username)
        readPoints.value = { ...readPoints.value, [ck]: lastId }
        saveReadPoints(currentUsername.value, readPoints.value)
      }
      if (window.electronAPI) {
        window.electronAPI.markChatRead(currentUsername.value, user.username, lastId || null).catch(() => {})
      }
      // 消息加载完毕、readPoint 更新后，再清零未读（此时用户已看到消息）
      userUnread.value = { ...userUnread.value, [user.username]: 0 }
      refreshTotalUnread()
      updateTaskbarBadge()
    }
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
      loadUsersAvatars(newMessages.map(m => m.from))
      // 更新最后消息
      updateLastMsgFromMessages(newMessages, selectedUser.value.username)
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
        loadUsersAvatars(newMessages.map(m => m.from))
        updateLastMsgFromMessages(newMessages, selectedUser.value.username)
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
          // 更新最后消息
          sharedLastMsgMap.value = {
            ...sharedLastMsgMap.value,
            ['user:' + selectedUser.value.username]: { message, time: new Date().toISOString(), from: currentUsername.value }
          }
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
          // 更新最后消息
          sharedLastMsgMap.value = {
            ...sharedLastMsgMap.value,
            ['user:' + selectedUser.value.username]: { message, time: new Date().toISOString(), from: currentUsername.value }
          }
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
      if (data.success) {
        lanFriendsList.value = data.friends || []
        loadUsersAvatars(lanFriendsList.value.map(f => f.username))
      }
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
      if (data.success) {
        lanGroupsList.value = data.groups || []
        lanGroupsList.value.forEach(g => loadUsersAvatars(g.members || []))
      }
    } catch (error) {
      console.error('[Chat] load LAN groups failed:', error)
    }
  }

  const loadPublicGroupsList = async () => {
    if (!window.electronAPI?.getGroups) return
    try {
      const result = await window.electronAPI.getGroups(currentUsername.value)
      if (result.success) {
        publicGroupsList.value = result.groups || []
        publicGroupsList.value.forEach(g => loadUsersAvatars(g.members || []))
      }
    } catch (e) {
      console.error('[Chat] load public groups failed:', e)
    }
  }

  const getGroupDND = (groupId) => {
    const username = currentUsername.value
    if (!username || !groupId) return false
    return localStorage.getItem(`groupDND_${username}_${groupId}`) === '1'
  }

  const getUserDND = (targetUsername) => {
    const username = currentUsername.value
    if (!username || !targetUsername) return false
    return localStorage.getItem(`userDND_${username}_${targetUsername}`) === '1'
  }

  const clearGroupUnread = (groupId) => {
    const username = currentUsername.value
    if (!username || !groupId) return
    const lastId = getLastRealMsgId()
    if (lastId) {
      const ck = groupConvKey(groupId)
      readPoints.value = { ...readPoints.value, [ck]: lastId }
      saveReadPoints(username, readPoints.value)
    }
    groupUnread.value = { ...groupUnread.value, [groupId]: 0 }
    refreshTotalUnread()
    if (window.electronAPI) {
        window.electronAPI.markGroupRead(username, groupId, lastId || null).catch(() => {})
    }
  }

  const clearUserUnread = (targetUsername) => {
    const username = currentUsername.value
    if (!username || !targetUsername) return
    const lastId = getLastRealMsgId()
    if (lastId) {
      const ck = userConvKey(targetUsername)
      readPoints.value = { ...readPoints.value, [ck]: lastId }
      saveReadPoints(username, readPoints.value)
    }
    userUnread.value = { ...userUnread.value, [targetUsername]: 0 }
    refreshTotalUnread()
    if (window.electronAPI) {
        window.electronAPI.markChatRead(username, targetUsername, lastId || null).catch(() => {})
    }
  }

  const getTotalUnread = () => {
    const username = currentUsername.value
    if (!username) return 0
    let total = 0
    for (const [key, count] of Object.entries(userUnread.value)) {
      if (!getUserDND(key) && typeof count === 'number') total += count
    }
    for (const [key, count] of Object.entries(groupUnread.value)) {
      if (!getGroupDND(key) && typeof count === 'number') total += count
    }
    return total
  }

  const selectGroup = async (group) => {
    selectedGroup.value = group
    selectedUser.value = null
    // 不立即清零 — 等消息加载完再加零
    await loadGroupMessages()
    if (group?.id) {
      const lastId = getLastRealMsgId()
      if (lastId) {
        const ck = groupConvKey(group.id)
        readPoints.value = { ...readPoints.value, [ck]: lastId }
        saveReadPoints(currentUsername.value, readPoints.value)
      }
      if (window.electronAPI) {
        window.electronAPI.markGroupRead(currentUsername.value, group.id, lastId || null).catch(() => {})
      }
      // 消息加载完后再清零
      groupUnread.value = { ...groupUnread.value, [group.id]: 0 }
      refreshTotalUnread()
      updateTaskbarBadge()
    }
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
      loadUsersAvatars(newMessages.map(m => m.from))
      updateGroupLastMsgFromMessages(newMessages, selectedGroup.value.id)
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
          if (data.success) {
            updateMessageStatus(tempId, true, data.data?.id)
            sharedLastMsgMap.value = { ...sharedLastMsgMap.value, ['group:' + groupId]: { message, time: new Date().toISOString(), from: currentUsername.value } }
          }
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
          if (result.success) {
            updateMessageStatus(tempId, true, result.data?.id)
            sharedLastMsgMap.value = { ...sharedLastMsgMap.value, ['group:' + groupId]: { message, time: new Date().toISOString(), from: currentUsername.value } }
          }
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

  let messagePollingTimer = null
  let unreadPollingTimer = null
  let unreadPollingActive = false
  const POLLING_INTERVAL = 2000
  const UNREAD_POLLING_INTERVAL = 5000

  const pollUnreadCounts = async () => {
    const username = currentUsername.value
    if (!username) return
    try {
      if (window.electronAPI && window.electronAPI.getUnreadCounts) {
        const rp = JSON.parse(JSON.stringify(readPoints.value))
        const result = await window.electronAPI.getUnreadCounts(username, rp)
        if (result.success) {
          const selUser = selectedUser.value
          console.log('[DIAG-CLIENT] pollUnreadCounts result:', JSON.stringify(result.conversations), 'selectedUser:', selUser?.username || 'none', 'current userUnread:', JSON.stringify(userUnread.value))
          const updatedUser = { ...userUnread.value }
          for (const [key, count] of Object.entries(result.conversations || {})) {
            // 跳过当前正在查看的会话
            if (selUser && selUser.username === key) {
              console.log('[DIAG-CLIENT] skipping selected user:', key)
              updatedUser[key] = 0
              continue
            }
            updatedUser[key] = typeof count === 'number' ? count : 0
          }
          console.log('[DIAG-CLIENT] setting userUnread to:', JSON.stringify(updatedUser))
          userUnread.value = updatedUser

          const selGroup = selectedGroup.value
          const updatedGroup = { ...groupUnread.value }
          for (const [key, count] of Object.entries(result.groups || {})) {
            if (selGroup && String(selGroup.id) === String(key)) {
              updatedGroup[key] = 0
              continue
            }
            updatedGroup[key] = typeof count === 'number' ? count : 0
          }
          groupUnread.value = updatedGroup
        }
      }
      if (lanSettings.value.serverIP) {
        for (const friend of lanFriendsList.value) {
          const target = friend.username
          if (selectedUser.value && selectedUser.value.username === target && selectedUser.value.chatMode === 'lan') continue
          const ck = userConvKey(target)
          const lastId = readPoints.value[ck] || '0'
          try {
            const response = await fetch(
              `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/messages?from=${encodeURIComponent(username)}&to=${encodeURIComponent(target)}`,
              { method: 'GET' }
            )
            const data = await response.json()
            if (data.success) {
              const msgs = (data.messages || [])
              const unread = msgs.filter(m =>
                m.from !== username && m.id && isNewerThan(m.id, lastId)
              ).length
              userUnread.value = { ...userUnread.value, [target]: unread }
            }
          } catch (_) {}
        }
        for (const group of lanGroupsList.value) {
          const gid = group.id
          if (selectedGroup.value && String(selectedGroup.value.id) === String(gid)) continue
          const ck = groupConvKey(gid)
          const lastId = readPoints.value[ck] || '0'
          try {
            const response = await fetch(
              `http://${lanSettings.value.serverIP}:${lanSettings.value.serverPort}/api/group-messages?groupId=${encodeURIComponent(gid)}`,
              { method: 'GET' }
            )
            const data = await response.json()
            if (data.success) {
              const msgs = (data.messages || [])
              const unread = msgs.filter(m =>
                m.from !== username && m.id && isNewerThan(m.id, lastId)
              ).length
              groupUnread.value = { ...groupUnread.value, [gid]: unread }
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('[Chat] pollUnreadCounts error:', e.message || e)
    }
    refreshTotalUnread()
    updateTaskbarBadge()
    console.log('[DIAG-CLIENT] after refresh, chatTotalUnread =', chatTotalUnread.value)
  }

  // 更新任务栏角标
  const updateTaskbarBadge = () => {
    const total = getTotalUnread()
    if (window.electronAPI && window.electronAPI.setBadgeCount) {
      window.electronAPI.setBadgeCount(total).catch(() => {})
    }
  }

  const scheduleUnreadPoll = () => {
    if (unreadPollingTimer) clearTimeout(unreadPollingTimer)
    unreadPollingTimer = setTimeout(async () => {
      if (unreadPollingActive) {
        scheduleUnreadPoll()
        return
      }
      unreadPollingActive = true
      try {
        await pollUnreadCounts()
      } finally {
        unreadPollingActive = false
        scheduleUnreadPoll()
      }
    }, UNREAD_POLLING_INTERVAL)
  }

  const startUnreadPolling = () => {
    unreadPollingActive = false
    pollUnreadCounts()
    scheduleUnreadPoll()
  }

  const stopUnreadPolling = () => {
    if (unreadPollingTimer) {
      clearTimeout(unreadPollingTimer)
      unreadPollingTimer = null
    }
    unreadPollingActive = false
  }

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
      if (selectedUser.value || selectedGroup.value) {
        const lastId = getLastRealMsgId()
        if (lastId) {
          let ck
          if (selectedGroup.value) ck = groupConvKey(selectedGroup.value.id)
          else if (selectedUser.value) ck = userConvKey(selectedUser.value.username)
          if (ck) {
            readPoints.value = { ...readPoints.value, [ck]: lastId }
            saveReadPoints(currentUsername.value, readPoints.value)
          }
        }
      }
    } catch (error) {}
  }

  const scheduleMessagePoll = () => {
    if (messagePollingTimer) clearTimeout(messagePollingTimer)
    messagePollingTimer = setTimeout(async () => {
      await pollForNewMessages()
      scheduleMessagePoll()
    }, POLLING_INTERVAL)
  }

  const startMessagePolling = () => {
    pollForNewMessages()
    scheduleMessagePoll()
  }

  const stopMessagePolling = () => {
    if (messagePollingTimer) {
      clearTimeout(messagePollingTimer)
      messagePollingTimer = null
    }
  }

  // ========== WebSocket 实时事件处理 ==========

  const handleWsNewMessage = (data) => {
    const username = currentUsername.value
    if (!username) return
    const sender = data.conversation?.target || data.message?.sender || data.message?.from
    if (!sender) return

    // 如果正在查看该用户的聊天，不增加未读
    if (selectedUser.value && selectedUser.value.username === sender) return

    // 增加未读计数
    const current = userUnread.value[sender] || 0
    userUnread.value = { ...userUnread.value, [sender]: current + 1 }

    // 更新最后消息
    const msg = data.message || {}
    sharedLastMsgMap.value = {
      ...sharedLastMsgMap.value,
      ['user:' + sender]: { message: msg.message || '', time: msg.timestamp || Date.now(), from: sender }
    }

    refreshTotalUnread()
    updateTaskbarBadge()

    // 闪烁窗口
    if (window.electronAPI && window.electronAPI.flashWindow) {
      window.electronAPI.flashWindow(true).catch(() => {})
    }
  }

  const handleWsNewGroupMessage = (data) => {
    const username = currentUsername.value
    if (!username) return
    const groupId = data.conversation?.target || data.message?.groupId
    if (!groupId) return

    // 如果正在查看该群聊，不增加未读
    if (selectedGroup.value && String(selectedGroup.value.id) === String(groupId)) return

    // 如果是自己发的消息，不增加未读
    const msgFrom = data.message?.from || data.message?.sender
    if (msgFrom === username) return

    const current = groupUnread.value[groupId] || 0
    groupUnread.value = { ...groupUnread.value, [groupId]: current + 1 }

    // 更新最后消息
    const msg = data.message || {}
    sharedLastMsgMap.value = {
      ...sharedLastMsgMap.value,
      ['group:' + groupId]: { message: msg.message || '', time: msg.timestamp || Date.now(), from: msgFrom }
    }

    refreshTotalUnread()
    updateTaskbarBadge()
  }

  const handleWsUpdateBadge = () => {
    updateTaskbarBadge()
  }

  const setupWebSocket = () => {
    if (!window.electronAPI) return
    window.electronAPI.wsConnect(currentUsername.value).catch(() => {})

    window.electronAPI.onWsNewMessage(handleWsNewMessage)
    window.electronAPI.onWsNewGroupMessage(handleWsNewGroupMessage)
    window.electronAPI.onWsUpdateBadge(handleWsUpdateBadge)
  }

  const teardownWebSocket = () => {
    if (!window.electronAPI) return
    window.electronAPI.removeWsListeners()
    window.electronAPI.wsDisconnect().catch(() => {})
    // 清除角标
    window.electronAPI.setBadgeCount(0).catch(() => {})
    window.electronAPI.flashWindow(false).catch(() => {})
  }

  // 从消息列表更新最后消息时间
  const updateLastMsgFromMessages = (msgs, targetUser) => {
    if (!msgs.length || !targetUser) return
    const last = msgs[msgs.length - 1]
    const key = 'user:' + targetUser
    const existing = sharedLastMsgMap.value[key]
    const newTime = new Date(last.timestamp || Date.now()).getTime()
    const oldTime = existing?.time ? new Date(existing.time).getTime() : 0
    if (newTime > oldTime || !existing) {
      sharedLastMsgMap.value = {
        ...sharedLastMsgMap.value,
        [key]: { message: last.message || '', time: last.timestamp || Date.now(), from: last.from || '' }
      }
    }
  }

  // 从群消息列表更新最后消息时间
  const updateGroupLastMsgFromMessages = (msgs, groupId) => {
    if (!msgs.length || !groupId) return
    const last = msgs[msgs.length - 1]
    const key = 'group:' + groupId
    const existing = sharedLastMsgMap.value[key]
    const newTime = new Date(last.timestamp || Date.now()).getTime()
    const oldTime = existing?.time ? new Date(existing.time).getTime() : 0
    if (newTime > oldTime || !existing) {
      sharedLastMsgMap.value = {
        ...sharedLastMsgMap.value,
        [key]: { message: last.message || '', time: last.timestamp || Date.now(), from: last.from || '' }
      }
    }
  }

  // 调试：监听 userUnread 的所有变化
  watch(userUnread, (newVal, oldVal) => {
    const changedKeys = []
    for (const key of Object.keys(newVal)) {
      if (newVal[key] !== oldVal[key]) changedKeys.push(key + ':' + oldVal[key] + '->' + newVal[key])
    }
    for (const key of Object.keys(oldVal)) {
      if (!(key in newVal)) changedKeys.push(key + ':deleted')
    }
    if (changedKeys.length > 0) {
      console.log('[DIAG-CLIENT] userUnread changed:', changedKeys.join(', '), 'stack:', new Error().stack.split('\n').slice(1, 4).join('\n'))
    }
  }, { deep: true })

  onMounted(() => {
    reloadLanSettings()
    const savedDeletedGroups = localStorage.getItem('deletedGroupIds')
    if (savedDeletedGroups) {
      deletedGroupIds.value = JSON.parse(savedDeletedGroups)
    }
    readPoints.value = loadReadPoints(currentUsername.value)
    // 加载上次保存的最后消息时间
    try {
      const saved = localStorage.getItem('chat_lastMsgMap_' + currentUsername.value)
      if (saved) sharedLastMsgMap.value = JSON.parse(saved)
    } catch (_) {}
    loadFriendsList()
    loadAllUsers()
    loadFriendRequests()
    loadPublicGroupsList()
    if (lanSettings.value.serverIP) loadLanFriendsList()
    startMessagePolling()
    startUnreadPolling()
    setupWebSocket()
  })

  onUnmounted(() => {
    // 保存最后消息时间
    localStorage.setItem('chat_lastMsgMap_' + currentUsername.value, JSON.stringify(sharedLastMsgMap.value))
    teardownWebSocket()
    stopMessagePolling()
    stopUnreadPolling()
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
    loadPublicGroupsList, groupUnread, getGroupDND, clearGroupUnread,
    userUnread, getUserDND, clearUserUnread, getTotalUnread,
    sharedLastMsgMap
  }
}

<template>
  <div class="chat-room-view">
    <el-container>
      <!-- 左侧好友列表 -->
      <el-aside width="280px" :class="['chat-aside', settingsStore.friendListDensity]">
        <div class="chat-tabs">
          <div class="tab-row">
            <el-radio-group v-model="activeTab" size="small">
              <el-radio-button value="conversations" :class="{ 'has-unread': hasAnyUnread }">{{ t('chatRoom.conversations') }}</el-radio-button>
              <el-radio-button value="contacts" :class="{ 'has-unread': showTabUnread && hasNonDNDContactUnread }">{{ t('chatRoom.contacts') }}</el-radio-button>
              <el-radio-button value="groups" :class="{ 'has-unread': showTabUnread && hasNonDNDGroupUnread }">{{ t('chatRoom.groups') }}</el-radio-button>
              <el-radio-button value="org">{{ t('org.title') }}</el-radio-button>
              <el-radio-button value="add">{{ t('chatRoom.addFriend') }}</el-radio-button>
              <el-radio-button value="requests" :class="{ 'has-pending': pendingRequestsCount > 0 }">
                {{ t('chatRoom.requests') }}
              </el-radio-button>
            </el-radio-group>
          </div>
        </div>
        
        <!-- 搜索框 -->
        <div class="search-box">
          <div class="search-row">
            <el-input
              v-model="searchQuery"
              :placeholder="searchPlaceholder"
              :prefix-icon="Search"
              clearable
            />
            <el-button
              v-if="activeTab === 'groups'"
              :icon="Plus"
              size="small"
              circle
              @click="showCreateGroupDialog = true"
              class="create-group-btn"
            />
          </div>
        </div>
        
        <div class="user-list">
          <!-- 统一会话列表 -->
          <template v-if="activeTab === 'conversations'">
            <div class="category-header">{{ t('chatRoom.conversations') }}</div>
            <div
              v-for="item in sortedConversations"
              :key="item.key"
              :class="['user-item', { active: isConversationActive(item) }]"
              @click="selectConversation(item)"
            >
              <el-badge :is-dot="item.dnd" :value="item.dnd ? '' : (item.unread || 0)" :hidden="!(item.unread)">
                <div class="avatar-with-status">
                  <el-avatar :size="40" :src="item.avatar">{{ item.name.charAt(0).toUpperCase() }}</el-avatar>
                  <span v-if="settingsStore.showOnlineStatus && item.type === 'user'" :class="['avatar-status-dot', onlineUsers[item.name] || 'offline']" />
                </div>
              </el-badge>
              <div class="user-info">
                <div class="user-name">
                  {{ item.name }}
                  <el-tag :type="item.serverOrigin === 'lan' ? 'warning' : 'primary'" size="small" effect="plain" class="network-tag">
                    {{ item.serverOrigin === 'lan' ? '🏠 内网' : '🌐 公网' }}
                  </el-tag>
                </div>
                <div class="user-role">{{ item.lastMsg || '' }}</div>
              </div>
              <el-tag v-if="item.dnd" size="small" effect="plain" class="dnd-tag">免打扰</el-tag>
            </div>
            <el-empty v-if="sortedConversations.length === 0" :description="t('chatRoom.noConversations')" />
          </template>

          <!-- 统一联系人列表（公网好友 + 内网用户） -->
          <template v-else-if="activeTab === 'contacts'">
            <div class="category-header">{{ t('chatRoom.contacts') }}</div>
            <div
              v-for="contact in sortedContacts"
              :key="contact.key"
              :class="['user-item', { active: selectedUser?.username === contact.username }]"
              @click="selectUser(contact)"
            >
              <el-badge :is-dot="getUserDND(contact.username)" :value="getUserDND(contact.username) ? '' : (getServerUnread(contact.serverOrigin, 'user')[contact.username] || 0)" :hidden="(getServerUnread(contact.serverOrigin, 'user')[contact.username] || 0) === 0">
                <div class="avatar-with-status">
                  <el-avatar :size="40" :src="contact.avatar">{{ contact.name.charAt(0).toUpperCase() }}</el-avatar>
                  <span v-if="settingsStore.showOnlineStatus" :class="['avatar-status-dot', onlineUsers[contact.username] || 'offline']" />
                </div>
              </el-badge>
              <div class="user-info">
                <div class="user-name">
                  {{ contact.name }}
                  <el-tag :type="contact.serverOrigin === 'lan' ? 'warning' : 'primary'" size="small" effect="plain" class="network-tag">
                    {{ contact.serverOrigin === 'lan' ? '🏠 内网' : '🌐 公网' }}
                  </el-tag>
                </div>
                <div class="user-role">
                  <span v-if="contact.online" class="online-status">{{ t('chatRoom.online') }}</span>
                  <span v-else>{{ t('chatRoom.offline') }}</span>
                </div>
              </div>
              <el-tag v-if="getUserDND(contact.username)" size="small" effect="plain" class="dnd-tag">免打扰</el-tag>
            </div>
            <el-empty v-if="sortedContacts.length === 0" :description="t('chatRoom.noContacts')" />
          </template>

          <!-- 统一群聊列表 -->
          <template v-else-if="activeTab === 'groups'">
            <div class="category-header">{{ t('chatRoom.groups') }}</div>
            <div
              v-for="group in sortedGroups"
              :key="group.key"
              :class="['user-item', { active: selectedGroup?.id === group.id }]"
              @click="selectGroup(group)"
            >
              <el-badge :is-dot="getGroupDND(group.id)" :value="getGroupDND(group.id) ? '' : (getServerUnread(group.serverOrigin, 'group')[group.id] || 0)" :hidden="(getServerUnread(group.serverOrigin, 'group')[group.id] || 0) === 0">
                <el-avatar :size="40" :src="groupAvatars[group.id] || ''" :style="groupAvatars[group.id] ? '' : 'background: var(--accent-color)'">
                  <el-icon v-if="!groupAvatars[group.id]"><ChatDotRound /></el-icon>
                </el-avatar>
              </el-badge>
              <div class="user-info">
                <div class="user-name">
                  {{ group.name }}
                  <el-tag :type="group.serverOrigin === 'lan' ? 'warning' : 'primary'" size="small" effect="plain" class="network-tag">
                    {{ group.serverOrigin === 'lan' ? '🏠 内网' : '🌐 公网' }}
                  </el-tag>
                </div>
                <div class="user-role">{{ t('chatRoom.members', { n: group.memberCount || group.members?.length || 0 }) }}</div>
              </div>
              <el-tag v-if="getGroupDND(group.id)" size="small" effect="plain" class="dnd-tag">免打扰</el-tag>
            </div>
            <el-empty v-if="sortedGroups.length === 0" :description="t('chatRoom.noGroups')" />
          </template>

          <!-- 添加好友 -->
          <template v-else-if="activeTab === 'add'">
            <div v-if="!searchQuery" class="recommended-tip">
              {{ t('chatRoom.recommended') }}
              <el-button size="small" text @click="showRecommended = !showRecommended">
                {{ showRecommended ? t('chatRoom.hide') : t('chatRoom.show') }}
              </el-button>
            </div>
            <div
              v-for="user in showRecommended ? filteredUsers : []"
              v-show="showRecommended || searchQuery"
              :key="user.username"
              class="user-item"
            >
              <el-avatar :size="40" :src="getUserAvatar(user.username)">{{ user.username.charAt(0).toUpperCase() }}</el-avatar>
              <div class="user-info">
                <div class="user-name">{{ user.username }}</div>
              </div>
              <el-button size="small" type="primary" @click="handleAddFriend(user)">
                {{ t('chatRoom.add') }}
              </el-button>
            </div>
            <el-empty v-if="filteredUsers.length === 0 && (showRecommended || searchQuery)" :description="t('chatRoom.noUsersFound')" />
          </template>

          <!-- 组织架构 -->
          <template v-else-if="activeTab === 'org'">
            <OrgTree
              @node-select="handleOrgNodeSelect"
              @select-members="handleOrgMembersSelect"
            />
          </template>

          <!-- 好友申请 -->
          <template v-else-if="activeTab === 'requests'">
            <div
              v-for="request in friendRequests"
              :key="request.id"
              class="request-item"
            >
              <el-avatar :size="40" :src="getUserAvatar(request.sender)">{{ request.sender.charAt(0).toUpperCase() }}</el-avatar>
              <div class="request-info">
                <div class="user-name">{{ request.sender }}</div>
                <div class="request-date">{{ formatDate(request.timestamp) }}</div>
              </div>
              <div class="request-actions">
                <el-button size="small" type="success" @click="handleRequest(request.id, 'accept')">
                  {{ t('chatRoom.accept') }}
                </el-button>
                <el-button size="small" type="danger" @click="handleRequest(request.id, 'reject')">
                  {{ t('chatRoom.reject') }}
                </el-button>
              </div>
            </div>
            <el-empty v-if="friendRequests.length === 0" :description="t('chatRoom.noRequests')" />
          </template>
        </div>
      </el-aside>
      
      <!-- 右侧聊天区域 -->
      <el-main>
        <div class="chat-main">
          <div class="chat-header">
            <span v-if="selectedGroup">{{ selectedGroup.name }}</span>
            <span v-else-if="selectedUser">{{ selectedUser.username }}</span>
            <span v-else class="placeholder">{{ t('chatRoom.selectUserToChat') }}</span>
            <!-- 更多按钮 -->
            <div v-if="selectedGroup || selectedUser" class="group-more-btn">
              <el-button
                :icon="MoreFilled"
                circle
                size="small"
                @click="showChatSettingsPanel = true"
              />
            </div>
          </div>
          
          <div class="chat-messages" ref="chatMessagesRef" @scroll="onChatScroll">
            <template v-if="selectedUser || selectedGroup">
              <div
                v-for="(msg, idx) in chatMessagesWithBubbles"
                :key="msg.id"
              >
                <!-- 时间分隔 -->
                <div v-if="msg._showTime" class="message-time-separator">
                  <span>{{ formatMessageTime(msg.timestamp) }}</span>
                </div>

                <div
                  :class="['chat-message', msg.from === currentUsername ? 'sent' : 'received']"
                  @contextmenu="handleMsgContextMenu($event, msg)"
                >
                  <el-avatar v-if="msg.from !== currentUsername" :size="36" :src="getUserAvatar(msg.from)" class="msg-avatar msg-avatar-left">
                    {{ msg.from.charAt(0).toUpperCase() }}
                  </el-avatar>

                  <div class="msg-body">
                    <div v-if="selectedGroup && msg.from !== currentUsername" class="message-sender">
                      {{ msg.from }}
                    </div>

                    <div v-if="msg._quote" class="quote-block" @click="scrollToQuoted(msg._quote)">
                      <span class="quote-label">{{ msg._quote.from === currentUsername ? t('chatRoom.you') : msg._quote.from }}</span>
                      <span class="quote-content">{{ truncateText(msg._quote.message, 50) }}</span>
                    </div>

                    <!-- 图片消息 -->
                    <div v-if="isImageMessage(msg.message)" class="message-content image-message">
                      <img :src="msg.message" :alt="t('chatRoom.image')" @load="onImageLoad" />
                    </div>
                    <!-- 文档消息 -->
                    <div v-else-if="isDocumentMessage(msg)" class="message-content document-message">
                      <div class="doc-card">
                        <span class="doc-icon">&#128196;</span>
                        <div class="doc-info">
                          <span class="doc-name">{{ parseDocumentInfo(msg.message)?.name || t('chatRoom.unknownDocument') }}</span>
                          <span class="doc-ext">{{ parseDocumentInfo(msg.message)?.ext || '' }}</span>
                        </div>
                      </div>
                    </div>
                    <!-- 文本消息 -->
                    <div v-else class="message-content">{{ msg.message }}</div>
                  </div>

                  <el-avatar v-if="msg.from === currentUsername" :size="36" :src="getUserAvatar(currentUsername)" class="msg-avatar msg-avatar-right">
                    {{ currentUsername.charAt(0).toUpperCase() }}
                  </el-avatar>
                </div>

                <!-- 自己消息的状态 -->
                <div v-if="msg.from === currentUsername" class="message-status-row">
                  <span v-if="msg._pending" class="msg-status sending">
                    <el-icon class="spin"><Loading /></el-icon> {{ t('chatRoom.sending') }}
                  </span>
                  <span v-else-if="msg._failed" class="msg-status-error" @click="retryMessage(msg)">
                    <el-icon><WarningFilled /></el-icon> {{ t('chatRoom.sendFailed') }}
                  </span>
                  <span v-else class="msg-status-sent">
                    <span v-if="msg._deliveryStatus === 'sent'" class="unread">&#10003;</span>
                    <span v-else-if="msg._deliveryStatus === 'delivered'" class="delivered">&#10003;&#10003;</span>
                    <span v-else class="read">&#10003;&#10003;</span>
                  </span>
                </div>
              </div>
              <el-empty v-if="chatMessages.length === 0" :description="t('chatRoom.noChatHistory')" />
            </template>
            <el-empty v-else :description="t('chatRoom.selectUserToChat')" />
          </div>
          
          <div class="chat-input">
            <div v-if="quotingMessage && (selectedUser || selectedGroup)" class="quote-preview-bar">
              <span class="quote-preview-label">{{ t('chatRoom.replyingTo') }} {{ quotingMessage.from }}:</span>
              <span class="quote-preview-content">{{ truncateText(quotingMessage.message, 40) }}</span>
              <el-icon class="quote-preview-close" @click="quotingMessage = null"><Close /></el-icon>
            </div>
            <el-popover
              v-if="selectedUser || selectedGroup"
              v-model:visible="uploadMenuVisible"
              placement="top-start"
              :width="140"
              trigger="click"
            >
              <template #reference>
                <el-button :icon="Plus" circle size="small" />
              </template>
              <div class="upload-menu">
                <el-button class="upload-menu-btn" text @click="uploadMenuVisible = false; handleSelectImage()">
                  <el-icon><Picture /></el-icon>
                  <span>{{ t('chatRoom.sendImage') }}</span>
                </el-button>
                <el-button class="upload-menu-btn" text @click="uploadMenuVisible = false; handleSelectDocument()">
                  <el-icon><Document /></el-icon>
                  <span>{{ t('chatRoom.sendDocument') }}</span>
                </el-button>
              </div>
            </el-popover>
            <el-input
              v-model="inputMessage"
              type="textarea"
              :placeholder="t('chatRoom.enterMessage')"
              :disabled="!selectedUser && !selectedGroup"
              :autosize="{ minRows: 1, maxRows: 5 }"
              @keydown.enter.exact="onEnterKey"
              @keydown.ctrl.enter="onCtrlEnterKey"
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
      :title="t('chatRoom.createGroup')"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item :label="t('chatRoom.groupName')">
          <el-input v-model="newGroupName" :placeholder="t('chatRoom.groupNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('chatRoom.groupMembers')">
          <el-select
            v-model="newGroupMembers"
            multiple
            :placeholder="t('chatRoom.selectMembers')"
            style="width: 100%"
          >
            <el-option
              v-for="contact in allContacts"
              :key="contact.key"
              :label="contact.name + (contact.serverOrigin === 'lan' ? ' (内网)' : '')"
              :value="contact.username"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateGroupDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="createGroup">{{ t('common.create') }}</el-button>
      </template>
    </el-dialog>

    <!-- 聊天设置侧边栏 -->
    <el-drawer
      v-model="showChatSettingsPanel"
      class="group-member-drawer"
      direction="rtl"
      size="280px"
      :title="chatSettingsTitle"
    >
      <GroupMemberPanel
        v-if="selectedGroup"
        :members="selectedGroup.members"
        :is-creator="selectedGroup.creator === currentUsername"
        :show-username="showUsernameInPanel"
        :group-id="selectedGroup.id"
        :current-username="currentUsername"
        mode="group"
        @close="showChatSettingsPanel = false"
        @disband="handleDisbandGroup"
        @exit="handleDeleteGroup"
      />
      <GroupMemberPanel
        v-else-if="selectedUser"
        :current-username="currentUsername"
        :target-username="selectedUser.username"
        mode="user"
        @close="showChatSettingsPanel = false"
        @delete-friend="onDeleteFriend"
      />
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick, onActivated, onDeactivated } from 'vue'
import { Search, Star, Promotion, Picture, ChatDotRound, MoreFilled, Loading, WarningFilled, Plus, Document, Close } from '@element-plus/icons-vue'
import { useChatRoom, sharedLastMsgMap, onlineUsers, groupAvatars } from '../../composables/useChatRoom'
import { useI18n } from '../../composables/useI18n'
import { useSettingsStore } from '../../stores/settings'
import { getUserAvatar } from '../../composables/useAvatar'
import GroupMemberPanel from './GroupMemberPanel.vue'
import OrgTree from '../common/OrgTree.vue'
import { useOrgStore } from '@/stores/org'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const showChatSettingsPanel = ref(false)
const showUsernameInPanel = ref(true)
const dndTick = ref(0)

// 监听设置面板关闭，强制刷新排序和 badge
watch(showChatSettingsPanel, (val) => {
  if (!val) dndTick.value++
})
const uploadMenuVisible = ref(false)

const {
  activeTab, hasLanServer, lanSettings, searchQuery,
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
  handleAddFriend, handleRequest, handleRemoveFriend,
  normalizeMessage, formatDate, formatMessageTime,
  isImageMessage, isDocumentMessage, parseDocumentInfo, onImageLoad, retryMessage,
  startMessagePolling, stopMessagePolling,
  switchTab, loadLanFriendsList, loadLanGroupsList,
  selectGroup, loadGroupMessages, sendGroupMessage,
  createGroup, handleSendMessage, handleDeleteGroup, handleDisbandGroup,
  loadPublicGroupsList, getServerUnread, getGroupDND,
  getUserDND,
  _pubUserUnread, _lanUserUnread, _pubGroupUnread, _lanGroupUnread,
  pollForNewMessages, pollUnreadCounts
} = useChatRoom()

const chatSettingsTitle = computed(() => {
  if (selectedGroup.value) return `${selectedGroup.value.name} (${selectedGroup.value.members.length})`
  if (selectedUser.value) return selectedUser.value.username
  return ''
})

// 发送消息快捷键处理
const onEnterKey = (event) => {
  if (settingsStore.sendKey === 'Enter') {
    handleSendMessage(event)
  }
  // Ctrl+Enter 模式下 Enter 换行保持默认行为
}

const onCtrlEnterKey = (event) => {
  if (settingsStore.sendKey === 'Ctrl+Enter') {
    handleSendMessage(event)
  }
}

const showTabUnread = computed(() => settingsStore.showTabUnreadBadge)

// 跨网络未读汇总
const hasNonDNDContactUnread = computed(() => {
  for (const [key, count] of Object.entries(_pubUserUnread.value)) {
    if (count > 0 && !getUserDND(key)) return true
  }
  for (const [key, count] of Object.entries(_lanUserUnread.value)) {
    if (count > 0 && !getUserDND(key)) return true
  }
  return false
})

const hasNonDNDGroupUnread = computed(() => {
  for (const [key, count] of Object.entries(_pubGroupUnread.value)) {
    if (count > 0 && !getGroupDND(key)) return true
  }
  for (const [key, count] of Object.entries(_lanGroupUnread.value)) {
    if (count > 0 && !getGroupDND(key)) return true
  }
  return false
})

const hasAnyUnread = computed(() => {
  return hasNonDNDContactUnread.value || hasNonDNDGroupUnread.value
})

// 统一联系人列表（公网好友 + 内网用户）
const allContacts = computed(() => {
  const contacts = []
  for (const f of friendsList.value) {
    contacts.push({ ...f, key: 'pub_' + f.username, name: f.username, serverOrigin: 'public', type: 'user', avatar: getUserAvatar(f.username) })
  }
  for (const u of lanFriendsList.value) {
    contacts.push({ ...u, key: 'lan_' + u.username, name: u.username, serverOrigin: 'lan', type: 'user', avatar: getUserAvatar(u.username) })
  }
  return contacts
})

// 统一群聊列表
const allGroups = computed(() => {
  const groups = []
  for (const g of filteredPublicGroupsList.value) {
    groups.push({ ...g, key: 'pub_group_' + g.id, serverOrigin: 'public', memberCount: g.members?.length || 0 })
  }
  for (const g of filteredLanGroupsList.value) {
    groups.push({ ...g, key: 'lan_group_' + g.id, serverOrigin: 'lan', memberCount: g.members?.length || 0 })
  }
  return groups
})

// 统一会话列表（联系人和群聊混合，按最后消息时间排序）
const sortedConversations = computed(() => {
  void dndTick.value
  const items = []
  for (const c of allContacts.value) {
    const unreadStore = getServerUnread(c.serverOrigin, 'user')
    const unread = unreadStore[c.username] || 0
    const lastMsg = sharedLastMsgMap.value['user:' + c.username]
    items.push({
      key: 'conv_user_' + c.serverOrigin + '_' + c.username,
      name: c.name,
      username: c.username,
      serverOrigin: c.serverOrigin,
      type: 'user',
      avatar: c.avatar,
      unread,
      dnd: getUserDND(c.username),
      lastMsg: lastMsg?.message || '',
      lastTime: lastMsg?.time || 0,
      _contact: c
    })
  }
  for (const g of allGroups.value) {
    const unreadStore = getServerUnread(g.serverOrigin, 'group')
    const unread = unreadStore[g.id] || 0
    const lastMsg = sharedLastMsgMap.value['group:' + g.id]
    items.push({
      key: 'conv_group_' + g.serverOrigin + '_' + g.id,
      name: g.name,
      id: g.id,
      serverOrigin: g.serverOrigin,
      type: 'group',
      avatar: groupAvatars.value[g.id] || '',
      unread,
      dnd: getGroupDND(g.id),
      lastMsg: lastMsg?.message || '',
      lastTime: lastMsg?.time || 0,
      _group: g
    })
  }
  // 免打扰排后，最后消息时间降序
  return items.sort((a, b) => {
    if (a.dnd !== b.dnd) return a.dnd ? 1 : -1
    return (b.lastTime || 0) - (a.lastTime || 0)
  })
})

// 联系人排序
const sortedContacts = computed(() => {
  void dndTick.value
  return [...allContacts.value].sort((a, b) => {
    const aDND = getUserDND(a.username)
    const bDND = getUserDND(b.username)
    if (aDND !== bDND) return aDND ? 1 : -1
    const aLast = sharedLastMsgMap.value['user:' + a.username]
    const bLast = sharedLastMsgMap.value['user:' + b.username]
    const aTime = aLast?.time ? new Date(aLast.time).getTime() : 0
    const bTime = bLast?.time ? new Date(bLast.time).getTime() : 0
    return bTime - aTime
  })
})

// 群聊排序
const sortedGroups = computed(() => {
  void dndTick.value
  return [...allGroups.value].sort((a, b) => {
    const aDND = getGroupDND(a.id)
    const bDND = getGroupDND(b.id)
    if (aDND !== bDND) return aDND ? 1 : -1
    const aLast = sharedLastMsgMap.value['group:' + a.id]
    const bLast = sharedLastMsgMap.value['group:' + b.id]
    const aTime = aLast?.time ? new Date(aLast.time).getTime() : 0
    const bTime = bLast?.time ? new Date(bLast.time).getTime() : 0
    return bTime - aTime
  })
})

// 判断会话是否活跃
const isConversationActive = (item) => {
  if (item.type === 'user') return selectedUser.value?.username === item.username
  if (item.type === 'group') return selectedGroup.value?.id === item.id
  return false
}

// 选择会话
const selectConversation = (item) => {
  if (item.type === 'user') {
    selectUser(item._contact)
  } else if (item.type === 'group') {
    selectGroup(item._group)
  }
}

const searchPlaceholder = computed(() => {
  if (activeTab.value === 'groups') return t('chatRoom.searchGroupPlaceholder')
  return t('chatRoom.searchUser')
})

watch([selectedUser, selectedGroup], () => {
  uploadMenuVisible.value = false
})

const chatMessagesRef = ref(null)
const autoScroll = ref(true)

function isAtBottom() {
  const el = chatMessagesRef.value
  if (!el) return false
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 50
}

function scrollToBottom() {
  if (!autoScroll.value) return
  nextTick(() => {
    const el = chatMessagesRef.value
    if (el && autoScroll.value) {
      el.scrollTop = el.scrollHeight
    }
  })
}

function onChatScroll() {
  autoScroll.value = isAtBottom()
}

watch(chatMessages, () => {
  if (autoScroll.value) {
    scrollToBottom()
  }
}, { deep: false })

watch([selectedUser, selectedGroup], () => {
  autoScroll.value = true
  if (selectedUser.value || selectedGroup.value) {
    scrollToBottom()
  }
})

const quotingMessage = ref(null)

function truncateText(text, maxLen) {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

function showTimeSep(currentMsg, prevMsg) {
  if (!prevMsg) return true
  const cur = new Date(currentMsg.timestamp || 0).getTime()
  const prev = new Date(prevMsg.timestamp || 0).getTime()
  return (cur - prev) > 5 * 60 * 1000
}

const chatMessagesWithBubbles = computed(() => {
  const msgs = chatMessages.value || []
  return msgs.map((msg, idx) => ({
    ...msg,
    _showTime: showTimeSep(msg, msgs[idx - 1]),
    _deliveryStatus: msg._deliveryStatus || 'sent',
    _quote: msg._quote || null
  }))
})

function handleMsgContextMenu(event, msg) {
  event.preventDefault()
  if (msg.from === currentUsername.value) {
    quotingMessage.value = msg
  }
}

async function onDeleteFriend(friendUsername) {
  await handleRemoveFriend(friendUsername)
  showChatSettingsPanel.value = false
}

function scrollToQuoted(quote) {
  if (!quote) return
}

// 组织架构事件处理
const orgStore = useOrgStore()

function handleOrgNodeSelect(node) {
  // 点击组织架构节点时不做选中用户操作，仅展开/高亮
}

function handleOrgMembersSelect(memberUsernames) {
  // 可以触发搜索或筛选联系人列表
  if (memberUsernames.length > 0) {
    searchQuery.value = ''
    activeTab.value = 'add'
  }
}

// KeepAlive 停用时清除选中会话，确保未读轮询正常计数
onDeactivated(() => {
  selectedUser.value = null
  selectedGroup.value = null
})

onActivated(() => {
  autoScroll.value = true
  scrollToBottom()
  // 立即同步所有消息和未读计数，无需等待轮询间隔
  pollForNewMessages()
  pollUnreadCounts()
})
</script>

<style lang="scss" scoped>
.chat-room-view {
  height: calc(100vh - 60px);

  :deep(.has-pending) .el-radio-button__inner {
    position: relative;

    &::after {
      content: '';
      position: absolute;
      top: 4px;
      right: 4px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f56c6c;
    }
  }

  :deep(.has-unread) .el-radio-button__inner {
    position: relative;

    &::after {
      content: '';
      position: absolute;
      top: 4px;
      right: 4px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f56c6c;
    }
  }

  :deep(.group-member-drawer .el-drawer__body) {
    padding: 0;
  }

  .el-container {
    height: 100%;
  }

  .el-main {
    padding: 0;
  }
  
  .el-aside {
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;

    &.compact {
      .user-item, .request-item {
        padding: 6px 12px;
        gap: 8px;

        :deep(.el-avatar) {
          width: 32px !important;
          height: 32px !important;
          font-size: 14px;
        }
      }
    }

    &.relaxed {
      .user-item, .request-item {
        padding: 12px;
        gap: 12px;
      }
    }
  }
  
  .chat-tabs {
      padding: 12px;
      border-bottom: 1px solid var(--border-color);

      .mode-switch-row {
          margin-bottom: 10px;
      }

      .tab-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
      }
  }
  
  .search-box {
      padding: 8px 12px;

      .search-row {
          display: flex;
          align-items: center;
          gap: 8px;

          .el-input {
              flex: 1;
          }

          .create-group-btn {
              flex-shrink: 0;
          }
      }
  }
  
  .user-list {
    flex: 1;
    overflow-y: auto;
    padding: 0;

    .category-header {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 12px 4px;
      margin-bottom: 0;
    }
    
    .user-item, .request-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 0;
      cursor: pointer;
      transition: all 0.15s;
      margin: 0;
      border-bottom: 1px solid var(--border-color);
      
      &:last-child {
        border-bottom: none;
      }
      
      &:hover {
        background: rgba(52, 152, 219, 0.08);
      }
      
      &.active {
        background: rgba(52, 152, 219, 0.15);
        color: var(--accent-color);
        border-left: 3px solid var(--accent-color);
        padding-left: 9px;
      }

      .el-badge {
        flex-shrink: 0;
        line-height: 0;
      }

      .avatar-with-status {
        position: relative;
        line-height: 0;

        .avatar-status-dot {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          border: 2px solid var(--bg-primary);

          &.online { background: #67c23a; }
          &.dnd { background: #e6a23c; }
          &.offline { background: #909399; }
        }
      }

      .dnd-tag {
        flex-shrink: 0;
        font-size: 11px;
        padding: 0 4px;
        height: 20px;
        line-height: 20px;
      }

      .network-tag {
        flex-shrink: 0;
        font-size: 10px;
        padding: 0 4px;
        height: 18px;
        line-height: 18px;
        margin-left: 4px;
        vertical-align: middle;
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

    .recommended-tip {
      padding: 12px 12px 4px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .request-item {
      .request-info {
        flex: 1;
      }

      .request-actions {
        display: flex;
        gap: 6px;

        .el-button {
          flex: 1;
          min-width: 0;
          padding: 5px 8px;
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
      border-bottom: 1px solid var(--border-color);
      font-size: 16px;
      font-weight: 500;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: space-between;

      .placeholder {
        color: var(--text-secondary);
      }
    }
    
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      overflow-anchor: none;
      
      .chat-message {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 12px;
        max-width: 80%;

        .msg-avatar {
          flex-shrink: 0;
          font-size: 14px;
          margin-top: 4px;

          &.msg-avatar-left { order: 0; }
          &.msg-avatar-right { order: 2; }
        }

        .msg-body {
          display: flex;
          flex-direction: column;
          order: 1;
          flex: 1;
          min-width: 0;
        }
        
        &.sent {
          margin-left: auto;
          
          .msg-body { align-items: flex-end; }

          .message-content {
            background: #95ec69;
            color: #000;
            border-radius: 4px;
            border-top-right-radius: 0;
          }
        }
        
        &.received {
          .msg-body { align-items: flex-start; }

          .message-content {
            background: var(--bg-secondary);
            color: var(--text-primary);
            border-radius: 4px;
            border-top-left-radius: 0;
          }
        }

        .quote-block {
          background: rgba(0, 0, 0, 0.06);
          border-left: 3px solid var(--accent-color);
          padding: 4px 8px;
          border-radius: 4px;
          margin-bottom: 4px;
          cursor: pointer;
          max-width: 300px;

          .quote-label {
            font-size: 11px;
            color: var(--accent-color);
            font-weight: 500;
          }
          .quote-content {
            font-size: 12px;
            color: var(--text-secondary);
            margin-left: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
        
        .message-content {
          padding: 10px 14px;
          word-break: break-word;
          min-width: 40px;
          line-height: 1.6;
          font-size: 14px;
          
          &.image-message {
            padding: 5px;
            background: transparent;
            
            img {
              max-width: 240px;
              max-height: 240px;
              border-radius: 8px;
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
          color: var(--accent-color);
          margin-bottom: 3px;
          padding: 0 4px;
          font-weight: 500;
        }
      }

      .message-time-separator {
        text-align: center;
        margin: 16px 0;

        span {
          font-size: 11px;
          color: var(--text-secondary);
          background: var(--bg-secondary);
          padding: 3px 12px;
          border-radius: 10px;
        }
      }

      .message-status-row {
        text-align: right;
        padding-right: 50px;
        margin-top: -6px;
        margin-bottom: 6px;
        font-size: 12px;

        .msg-status {
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          gap: 3px;

          &.spin { animation: spin 0.8s linear infinite; }
        }

        .msg-status-error {
          color: #f56c6c;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 3px;

          &:hover { text-decoration: underline; }
        }

        .msg-status-sent {
          color: var(--text-secondary);

          .unread { color: #b2b2b2; }
          .delivered { color: #b2b2b2; }
          .read { color: #07c160; }
        }
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .chat-input {
      padding: 15px 20px;
      background: var(--bg-secondary);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .quote-preview-bar {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(var(--accent-rgb, 52, 152, 219), 0.08);
        border-left: 3px solid var(--accent-color);
        border-radius: 4px;
        font-size: 13px;

        .quote-preview-label {
          color: var(--accent-color);
          font-weight: 500;
          white-space: nowrap;
        }

        .quote-preview-content {
          color: var(--text-secondary);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .quote-preview-close {
          cursor: pointer;
          color: var(--text-secondary);
          flex-shrink: 0;

          &:hover { color: var(--text-primary); }
        }
      }

      .image-uploader {
        display: inline-block;

        :deep(.el-upload) {
          border: none;
        }
      }

      .el-textarea {
        flex: 1;
        overflow: hidden;
        border-radius: 20px;
        padding-right: 5px;

        :deep(.el-textarea__inner) {
          border-radius: 20px;
          background: var(--bg-primary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          padding: 8px 15px;
          resize: none;
          line-height: 1.4;
          min-height: 35px;
          box-shadow: none;
          transition: border-color 0.2s;
          scrollbar-width: thin;
          display: block;

          &::-webkit-scrollbar-track {
            margin-block: 2px;
            background: transparent;
          }

          &::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 4px;
          }

          &:focus {
            border-color: var(--accent-color);
          }
        }
      }

      .el-button {
        border-radius: 20px;
        font-weight: 500;

        :deep(.el-icon) {
          font-size: 16px;
        }

        &.is-circle {
          width: 35px;
          height: 35px;
          padding: 0;
        }

        &:not(.is-circle) {
          height: 35px;
          padding: 0 20px;
        }
      }
    }

    .upload-menu {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .upload-menu-btn {
        width: 100%;
        justify-content: flex-start;
        padding: 6px 8px;
        margin-left: 0;
        height: auto;
        font-size: 14px;
      }
    }

    .document-message {
      padding: 0;
      background: transparent !important;

      .doc-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        min-width: 160px;

        .doc-icon {
          font-size: 28px;
          line-height: 1;
        }

        .doc-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;

          .doc-name {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .doc-ext {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
          }
        }
      }
    }
  }
}
</style>

<style>
.upload-menu .upload-menu-btn {
  margin-left: 0 !important;
}
</style>

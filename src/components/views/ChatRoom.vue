<template>
  <div class="chat-room-view">
    <el-container>
      <!-- 左侧好友列表 -->
      <el-aside width="280px" :class="['chat-aside', settingsStore.friendListDensity]">
        <div class="chat-tabs">
          <!-- 聊天模式切换 -->
          <div class="mode-switch-row">
            <el-radio-group v-model="chatMode" size="small" @change="handleChatModeChange">
              <el-radio-button value="public" :class="{ 'has-unread': showModeUnread && chatMode === 'lan' && hasPublicUnread }">
                {{ t('chatRoom.public') }}
              </el-radio-button>
              <el-radio-button v-if="lanSettings.serverIP" value="lan" :class="{ 'has-unread': showModeUnread && chatMode === 'public' && hasLanUnread }">
                {{ t('chatRoom.lan') }}
              </el-radio-button>
            </el-radio-group>
          </div>

          <div class="tab-row">
            <el-radio-group v-model="activeTab" size="small">
              <!-- 公网模式显示：好友、群聊、架构、添加好友、申请 -->
              <template v-if="chatMode === 'public'">
                <el-radio-button value="friends" :class="{ 'has-unread': showTabUnread && hasNonDNDFriendUnread }">{{ t('chatRoom.friends') }}</el-radio-button>
                <el-radio-button value="groups" :class="{ 'has-unread': showTabUnread && hasNonDNDGroupUnread }">{{ t('chatRoom.groups') }}</el-radio-button>
                <el-radio-button value="org">{{ t('org.title') }}</el-radio-button>
                <el-radio-button value="add">{{ t('chatRoom.addFriend') }}</el-radio-button>
                <el-radio-button value="requests" :class="{ 'has-pending': pendingRequestsCount > 0 }">
                  {{ t('chatRoom.requests') }}
                </el-radio-button>
              </template>
              <!-- 内网模式显示：用户、群聊、架构 -->
              <template v-else>
                <el-radio-button value="users" :class="{ 'has-unread': showTabUnread && hasNonDNDFriendUnread }">{{ t('chatRoom.users') }}</el-radio-button>
                <el-radio-button value="groups" :class="{ 'has-unread': showTabUnread && hasNonDNDGroupUnread }">{{ t('chatRoom.groups') }}</el-radio-button>
                <el-radio-button value="org">{{ t('org.title') }}</el-radio-button>
              </template>
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
        
        <!-- 好友/用户列表 -->
        <div class="user-list">
          <!-- 公网：好友列表 -->
          <template v-if="chatMode === 'public' && activeTab === 'friends'">
            <div class="category-header">{{ t('chatRoom.friends') }}</div>
            <div 
              v-for="friend in sortedFriendsList" 
              :key="friend.username"
              :class="['user-item', { active: selectedUser?.username === friend.username }]"
              @click="selectUser(friend, 'public')"
            >
              <el-badge :is-dot="getUserDND(friend.username)" :value="getUserDND(friend.username) ? '' : (userUnread[friend.username] || 0)" :hidden="(userUnread[friend.username] || 0) === 0">
                <el-avatar :size="40" :src="getUserAvatar(friend.username)">{{ friend.username.charAt(0).toUpperCase() }}</el-avatar>
              </el-badge>
              <div class="user-info">
                <div class="user-name">{{ friend.username }}</div>
                <div class="user-role">
                  <span v-if="friend.online" class="online-status">{{ t('chatRoom.online') }}</span>
                  <span v-else>{{ t('chatRoom.offline') }}</span>
                </div>
              </div>
              <el-tag v-if="getUserDND(friend.username)" size="small" effect="plain" class="dnd-tag">免打扰</el-tag>
              <el-icon 
                v-if="friend.starred" 
                class="star-icon starred"
              ><Star /></el-icon>
            </div>
            <el-empty v-if="friendsList.length === 0" :description="t('chatRoom.noFriends')" />
          </template>
          
          <!-- 公网：群聊列表 -->
          <template v-else-if="chatMode === 'public' && activeTab === 'groups'">
            <div class="category-header">我的群聊</div>
            <div
              v-for="group in sortedPublicGroupsList"
              :key="group.id"
              :class="['user-item', { active: selectedGroup?.id === group.id }]"
              @click="selectGroup(group)"
            >
              <el-badge :is-dot="getGroupDND(group.id)" :value="getGroupDND(group.id) ? '' : (groupUnread[group.id] || 0)" :hidden="(groupUnread[group.id] || 0) === 0">
                <el-avatar :size="40" style="background: var(--accent-color)">
                  <el-icon><ChatDotRound /></el-icon>
                </el-avatar>
              </el-badge>
              <div class="user-info">
                <div class="user-name">{{ group.name }}</div>
                <div class="user-role">{{ t('chatRoom.members', { n: group.members.length }) }}</div>
              </div>
              <el-tag v-if="getGroupDND(group.id)" size="small" effect="plain" class="dnd-tag">免打扰</el-tag>
            </div>
            <el-empty v-if="sortedPublicGroupsList.length === 0" :description="t('chatRoom.noGroups')" />
          </template>
          
          <!-- 内网：用户列表 -->
          <template v-else-if="chatMode === 'lan' && activeTab === 'users'">
            <div class="category-header">{{ t('chatRoom.users') }}</div>
            <div 
              v-for="user in sortedLanFriendsList" 
              :key="user.username"
              :class="['user-item', { active: selectedUser?.username === user.username }]"
              @click="selectUser(user, 'lan')"
            >
              <el-badge :is-dot="getUserDND(user.username)" :value="getUserDND(user.username) ? '' : (userUnread[user.username] || 0)" :hidden="(userUnread[user.username] || 0) === 0">
                <el-avatar :size="40" :src="getUserAvatar(user.username)">{{ user.username.charAt(0).toUpperCase() }}</el-avatar>
              </el-badge>
              <div class="user-info">
                <div class="user-name">{{ user.username }}</div>
                <div class="user-role">
                  <span v-if="user.online" class="online-status">{{ t('chatRoom.online') }}</span>
                  <span v-else>{{ t('chatRoom.offline') }}</span>
                </div>
              </div>
              <el-tag v-if="getUserDND(user.username)" size="small" effect="plain" class="dnd-tag">免打扰</el-tag>
            </div>
            <el-empty v-if="lanFriendsList.length === 0" :description="t('chatRoom.noLanUsers')" />
          </template>
          
          <!-- 内网：群聊列表 -->
          <template v-else-if="chatMode === 'lan' && activeTab === 'groups'">
            <div class="category-header">我的群聊</div>
            <div
              v-for="group in sortedLanGroupsList"
              :key="group.id"
              :class="['user-item', { active: selectedGroup?.id === group.id }]"
              @click="selectGroup(group)"
            >
              <el-badge :is-dot="getGroupDND(group.id)" :value="getGroupDND(group.id) ? '' : (groupUnread[group.id] || 0)" :hidden="(groupUnread[group.id] || 0) === 0">
                <el-avatar :size="40" style="background: var(--accent-color)">
                  <el-icon><ChatDotRound /></el-icon>
                </el-avatar>
              </el-badge>
              <div class="user-info">
                <div class="user-name">{{ group.name }}</div>
                <div class="user-role">{{ t('chatRoom.members', { n: group.members.length }) }}</div>
              </div>
              <el-tag v-if="getGroupDND(group.id)" size="small" effect="plain" class="dnd-tag">免打扰</el-tag>
            </div>
            <el-empty v-if="sortedLanGroupsList.length === 0" :description="t('chatRoom.noGroups')" />
          </template>
          
          <!-- 公网：添加好友 -->
          <template v-else-if="chatMode === 'public' && activeTab === 'add'">
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
          
          <!-- 公网/内网：组织架构 -->
          <template v-else-if="activeTab === 'org'">
            <OrgTree
              @node-select="handleOrgNodeSelect"
              @select-members="handleOrgMembersSelect"
            />
          </template>

          <!-- 公网：好友申请 -->
          <template v-else-if="chatMode === 'public' && activeTab === 'requests'">
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
          
          <div class="chat-messages" ref="chatMessagesRef">
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
              v-for="user in (chatMode === 'lan' ? lanFriendsList : friendsList)"
              :key="user.username"
              :label="user.username"
              :value="user.username"
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
      />
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick, onDeactivated } from 'vue'
import { Search, Star, Promotion, Picture, ChatDotRound, MoreFilled, Loading, WarningFilled, Plus, Document, Close } from '@element-plus/icons-vue'
import { useChatRoom, sharedLastMsgMap } from '../../composables/useChatRoom'
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
  loadPublicGroupsList,
  groupUnread, getGroupDND,
  userUnread, getUserDND,
  _pubUserUnread, _lanUserUnread, _pubGroupUnread, _lanGroupUnread
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

// 当前模式的未读（userUnread/groupUnread 已按 chatMode 自动路由到正确存储）
const hasNonDNDFriendUnread = computed(() => {
  for (const [key, count] of Object.entries(userUnread.value)) {
    if (count > 0 && !getUserDND(key)) return true
  }
  return false
})

const hasNonDNDGroupUnread = computed(() => {
  for (const [key, count] of Object.entries(groupUnread.value)) {
    if (count > 0 && !getGroupDND(key)) return true
  }
  return false
})

// "另一模式"的未读汇总（用于在模式切换按钮上显示角标）
const hasPublicUnread = computed(() => {
  const store = _pubUserUnread.value
  for (const [key, count] of Object.entries(store)) {
    if (count > 0 && !getUserDND(key)) return true
  }
  const gstore = _pubGroupUnread.value
  for (const [key, count] of Object.entries(gstore)) {
    if (count > 0 && !getGroupDND(key)) return true
  }
  return false
})

const hasLanUnread = computed(() => {
  const store = _lanUserUnread.value
  for (const [key, count] of Object.entries(store)) {
    if (count > 0 && !getUserDND(key)) return true
  }
  const gstore = _lanGroupUnread.value
  for (const [key, count] of Object.entries(gstore)) {
    if (count > 0 && !getGroupDND(key)) return true
  }
  return false
})

// 可从设置控制的角标显示开关
const showModeUnread = computed(() => settingsStore.showModeUnreadBadge)
const showTabUnread = computed(() => settingsStore.showTabUnreadBadge)

// 排序列表：免打扰的排到后面，再按最后消息时间降序
const sortedFriendsList = computed(() => {
  void dndTick.value
  return [...friendsList.value].sort((a, b) => {
    const aDND = getUserDND(a.username)
    const bDND = getUserDND(b.username)
    if (aDND !== bDND) return aDND ? 1 : -1
    // 按最后消息时间降序
    const aLast = sharedLastMsgMap.value['user:' + a.username]
    const bLast = sharedLastMsgMap.value['user:' + b.username]
    const aTime = aLast?.time ? new Date(aLast.time).getTime() : 0
    const bTime = bLast?.time ? new Date(bLast.time).getTime() : 0
    return bTime - aTime
  })
})

const sortedLanFriendsList = computed(() => {
  void dndTick.value
  return [...lanFriendsList.value].sort((a, b) => {
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

// 群聊排序：最后消息时间降序
const sortedPublicGroupsList = computed(() => {
  void dndTick.value
  return [...filteredPublicGroupsList.value].sort((a, b) => {
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

const sortedLanGroupsList = computed(() => {
  void dndTick.value
  return [...filteredLanGroupsList.value].sort((a, b) => {
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

const searchPlaceholder = computed(() => {
  if (chatMode.value === 'public' && activeTab.value === 'groups') {
    return t('chatRoom.searchGroupPlaceholder')
  }
  if (chatMode.value === 'lan' && activeTab.value === 'groups') {
    return t('chatRoom.searchGroupPlaceholder')
  }
  return t('chatRoom.searchUser')
})

watch([selectedUser, selectedGroup], () => {
  uploadMenuVisible.value = false
})

const chatMessagesRef = ref(null)

function scrollToBottom() {
  nextTick(() => {
    const el = chatMessagesRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
}

watch(chatMessages, () => {
  scrollToBottom()
}, { deep: false })

watch([selectedUser, selectedGroup], () => {
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

      .dnd-tag {
        flex-shrink: 0;
        font-size: 11px;
        padding: 0 4px;
        height: 20px;
        line-height: 20px;
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

<template>
  <div class="chat-room-view">
    <el-container>
      <!-- 左侧好友列表 -->
      <el-aside width="280px">
        <div class="chat-tabs">
          <!-- 聊天模式切换 -->
          <div class="mode-switch-row">
            <el-radio-group v-model="chatMode" size="small" @change="handleChatModeChange">
              <el-radio-button label="public">{{ t('chatRoom.public') }}</el-radio-button>
              <el-radio-button v-if="useLanChat" label="lan">{{ t('chatRoom.lan') }}</el-radio-button>
            </el-radio-group>
          </div>

          <el-radio-group v-model="activeTab" size="small">
            <!-- 公网模式显示：好友、添加好友、申请 -->
            <template v-if="chatMode === 'public'">
              <el-radio-button label="friends">{{ t('chatRoom.friends') }}</el-radio-button>
              <el-radio-button label="add">{{ t('chatRoom.addFriend') }}</el-radio-button>
              <el-radio-button label="requests">{{ t('chatRoom.requests') }}</el-radio-button>
            </template>
            <!-- 内网模式显示：用户、群聊 -->
            <template v-else>
              <el-radio-button label="users">{{ t('chatRoom.users') }}</el-radio-button>
              <el-radio-button label="groups">{{ t('chatRoom.groups') }}</el-radio-button>
            </template>
          </el-radio-group>
        </div>
        
        <!-- 搜索框 -->
        <div class="search-box">
          <el-input
            v-model="searchQuery"
            :placeholder="t('chatRoom.searchUser')"
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
                  <span v-if="friend.online" class="online-status">{{ t('chatRoom.online') }}</span>
                  <span v-else>{{ t('chatRoom.offline') }}</span>
                </div>
              </div>
              <el-icon 
                v-if="friend.starred" 
                class="star-icon starred"
              ><Star /></el-icon>
            </div>
            <el-empty v-if="friendsList.length === 0" :description="t('chatRoom.noFriends')" />
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
                  <span v-if="user.online" class="online-status">{{ t('chatRoom.online') }}</span>
                  <span v-else>{{ t('chatRoom.offline') }}</span>
                </div>
              </div>
            </div>
            <el-empty v-if="lanFriendsList.length === 0" :description="t('chatRoom.noLanUsers')" />
          </template>
          
          <!-- 内网：群聊列表 -->
          <template v-else-if="chatMode === 'lan' && activeTab === 'groups'">
            <div class="group-actions">
              <el-button type="primary" size="small" @click="showCreateGroupDialog = true">
                {{ t('chatRoom.createGroup') }}
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
                <div class="user-role">{{ t('chatRoom.members', { n: group.members.length }) }}</div>
              </div>
            </div>
            <el-empty v-if="filteredLanGroupsList.length === 0" :description="t('chatRoom.noGroups')" />
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
              <el-avatar :size="40">{{ user.username.charAt(0).toUpperCase() }}</el-avatar>
              <div class="user-info">
                <div class="user-name">{{ user.username }}</div>
              </div>
              <el-button size="small" type="primary" @click="handleAddFriend(user)">
                {{ t('chatRoom.add') }}
              </el-button>
            </div>
            <el-empty v-if="filteredUsers.length === 0 && (showRecommended || searchQuery)" :description="t('chatRoom.noUsersFound')" />
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
            <!-- 群聊操作按钮 -->
            <div v-if="selectedGroup" class="group-actions">
              <el-button
                v-if="selectedGroup.creator === currentUsername"
                type="danger"
                size="small"
                @click="handleDisbandGroup"
              >
                {{ t('chatRoom.disbandGroup') }}
              </el-button>
              <el-button
                size="small"
                @click="handleDeleteGroup"
              >
                {{ t('chatRoom.deleteChat') }}
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
                  <img :src="msg.message" :alt="t('chatRoom.image')" @load="onImageLoad" />
                </div>
                <!-- 文本消息 -->
                <div v-else class="message-content">{{ msg.message }}</div>
                <div class="message-time">{{ formatMessageTime(msg.timestamp) }}</div>
              </div>
              <el-empty v-if="chatMessages.length === 0" :description="t('chatRoom.noChatHistory')" />
            </template>
            <el-empty v-else :description="t('chatRoom.selectUserToChat')" />
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
              :placeholder="t('chatRoom.enterMessage')"
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
              v-for="user in lanFriendsList"
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
  </div>
</template>

<script setup>
import { Search, Star, Promotion, Picture, ChatDotRound } from '@element-plus/icons-vue'
import { useChatRoom } from '../../composables/useChatRoom'
import { useI18n } from '../../composables/useI18n'

const { t } = useI18n()

const {
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
  createGroup, handleSendMessage, handleDeleteGroup, handleDisbandGroup
} = useChatRoom()
</script>

<style lang="scss" scoped>
.chat-room-view {
  height: calc(100vh - 60px);
  
  .el-container {
    height: 100%;
  }
  
  .el-aside {
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
  }
  
  .chat-tabs {
    padding: 15px;
    border-bottom: 1px solid var(--border-color);

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

<template>
  <div class="group-member-panel">
    <!-- 成员区域（仅群聊模式） -->
    <template v-if="mode === 'group'">
      <div class="section section-members">
        <div class="member-grid">
          <div
            v-for="member in members"
            :key="member"
            class="member-item"
          >
            <el-avatar :size="48" :src="getUserAvatar(member)" class="member-avatar">{{ member.charAt(0).toUpperCase() }}</el-avatar>
            <div v-if="showUsername" class="member-name">{{ formatName(member) }}</div>
          </div>
        </div>
      </div>

      <el-divider />
    </template>

    <!-- 我的设置 -->
    <div class="section section-settings">
      <el-form label-width="0">
        <el-form-item v-if="mode === 'group'" label="">
          <div class="setting-row vertical">
            <span class="setting-label">我在本群聊的昵称</span>
            <el-input
              v-model="myNickname"
              size="small"
              placeholder="默认使用用户名"
              maxlength="20"
              show-word-limit
              @blur="saveSettings"
            />
          </div>
        </el-form-item>
        <el-form-item label="">
          <div class="setting-row">
            <span class="setting-label">{{ mode === 'group' ? '群聊免打扰' : '消息免打扰' }}</span>
            <el-switch v-model="dndEnabled" size="small" @change="saveSettings" />
          </div>
        </el-form-item>
      </el-form>
    </div>

    <!-- 操作按钮（仅群聊模式） -->
    <template v-if="mode === 'group'">
      <el-divider />

      <div v-if="isCreator" class="section section-settings">
        <div class="setting-row vertical">
          <span class="setting-label">群聊头像</span>
          <div class="group-avatar-row">
            <el-avatar :size="64" :src="groupAvatarData">群</el-avatar>
            <el-button size="small" @click="openAvatarPicker">更换头像</el-button>
            <input ref="avatarInputRef" type="file" accept="image/*" style="display:none" @change="onAvatarFileChange" />
          </div>
        </div>
      </div>

      <el-divider />

      <div class="section section-actions">
        <el-button v-if="isCreator" type="danger" size="small" @click="handleDisband">解散群聊</el-button>
        <el-button v-else size="small" @click="handleExit">退出群聊</el-button>
      </div>
    </template>

    <!-- 用户模式操作 -->
    <template v-if="mode === 'user'">
      <el-divider />
      <div class="section section-actions">
        <el-button type="danger" size="small" @click="handleDeleteFriend">删除好友</el-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { getUserAvatar, loadUsersAvatars } from '../../composables/useAvatar'
import { groupAvatars } from '../../composables/useChatRoom'

const props = defineProps({
    members: { type: Array, default: () => [] },
    isCreator: { type: Boolean, default: false },
    showUsername: { type: Boolean, default: true },
    groupId: { type: [String, Number], default: '' },
    currentUsername: { type: String, default: '' },
    mode: { type: String, default: 'group' },
    targetUsername: { type: String, default: '' }
})

const emit = defineEmits(['close', 'disband', 'exit', 'deleteFriend'])

const myNickname = ref('')
const dndEnabled = ref(false)
const groupAvatarData = ref('')
const avatarInputRef = ref(null)

function groupAvatarKey() {
    return `groupAvatar_${props.groupId}`
}

function openAvatarPicker() {
    avatarInputRef.value?.click()
}

function onAvatarFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
        const dataUrl = reader.result
        groupAvatarData.value = dataUrl
        localStorage.setItem(groupAvatarKey(), dataUrl)
        groupAvatars.value = { ...groupAvatars.value, [props.groupId]: dataUrl }
        e.target.value = ''
    }
    reader.readAsDataURL(file)
}

function nicknameKey() {
    return `groupNickname_${props.currentUsername}_${props.groupId}`
}

function dndKey() {
    if (props.mode === 'user') {
        return `userDND_${props.currentUsername}_${props.targetUsername}`
    }
    return `groupDND_${props.currentUsername}_${props.groupId}`
}

const saveSettings = () => {
    if (props.mode === 'group') {
        localStorage.setItem(nicknameKey(), myNickname.value)
    }
    localStorage.setItem(dndKey(), dndEnabled.value ? '1' : '0')
}

const formatName = (name) => {
    if (name.length <= 10) return name
    return name.slice(0, 4) + '..' + name.slice(-4)
}

const handleDisband = () => {
    ElMessageBox.confirm('确定要解散此群聊？', '解散群聊', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(() => {
        emit('disband')
    }).catch(() => {})
}

const handleExit = () => {
    ElMessageBox.confirm('确定要退出此群聊？', '退出群聊', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(() => {
        emit('exit')
    }).catch(() => {})
}

const handleDeleteFriend = () => {
    ElMessageBox.confirm(`确定删除好友 "${props.targetUsername}"？`, '删除好友', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
    }).then(() => {
        emit('deleteFriend', props.targetUsername)
    }).catch(() => {})
}

onMounted(() => {
    myNickname.value = localStorage.getItem(nicknameKey()) || ''
    dndEnabled.value = localStorage.getItem(dndKey()) === '1'
    const saved = localStorage.getItem(groupAvatarKey()) || ''
    groupAvatarData.value = saved
    if (saved) {
        groupAvatars.value = { ...groupAvatars.value, [props.groupId]: saved }
    }
    loadUsersAvatars(props.members)
})

watch(() => props.members, (members) => {
    loadUsersAvatars(members)
})
</script>

<style lang="scss" scoped>
.group-member-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;

    :deep(.el-divider--horizontal) {
        margin: 4px 0;
    }

    .section {
        padding: 8px 0;

        .section-label {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 8px;
            font-weight: 500;
        }

        &.section-members {
            .member-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;

                .member-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    width: 64px;
                    flex-shrink: 0;

                    .member-name {
                        font-size: 12px;
                        color: var(--text-secondary);
                        text-align: center;
                        line-height: 1.2;
                        max-width: 64px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                }
            }
        }

        &.section-settings {
            .setting-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;

                &.vertical {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 6px;
                }

                .setting-label {
                    font-size: 13px;
                    color: var(--text-primary);
                    white-space: nowrap;
                    margin-right: 12px;
                }
            }

            .el-form-item {
            margin-bottom: 8px;

                &:last-child {
                    margin-bottom: 0;
                }
            }
        }

        &.section-actions {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: auto;
        }
    }

    .group-avatar-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 4px;
    }
}
</style>
<template>
  <div class="group-member-panel">
    <!-- 成员区域 -->
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

    <!-- 我的设置 -->
    <div class="section section-settings">
      <el-form label-width="0">
        <el-form-item label="">
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
            <span class="setting-label">群聊免打扰</span>
            <el-switch v-model="dndEnabled" size="small" @change="saveSettings" />
          </div>
        </el-form-item>
      </el-form>
    </div>

    <el-divider />

    <!-- 操作按钮 -->
    <div class="section section-actions">
      <el-button
        v-if="isCreator"
        type="danger"
        size="small"
        @click="handleDisband"
      >
        解散群聊
      </el-button>
      <el-button
        v-else
        size="small"
        @click="handleExit"
      >
        退出群聊
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { getUserAvatar } from '../../composables/useAvatar'

const props = defineProps({
    members: { type: Array, default: () => [] },
    isCreator: { type: Boolean, default: false },
    showUsername: { type: Boolean, default: true },
    groupId: { type: [String, Number], default: '' },
    currentUsername: { type: String, default: '' }
})

const emit = defineEmits(['close', 'disband', 'exit'])

const myNickname = ref('')
const dndEnabled = ref(false)

function nicknameKey() {
    return `groupNickname_${props.currentUsername}_${props.groupId}`
}

function dndKey() {
    return `groupDND_${props.currentUsername}_${props.groupId}`
}

const saveSettings = () => {
    localStorage.setItem(nicknameKey(), myNickname.value)
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

onMounted(() => {
    myNickname.value = localStorage.getItem(nicknameKey()) || ''
    dndEnabled.value = localStorage.getItem(dndKey()) === '1'
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
}
</style>
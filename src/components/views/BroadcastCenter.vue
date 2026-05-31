<template>
  <div class="broadcast-center">
    <div class="bc-header">
      <h2>{{ t('broadcast.title') }}</h2>
    </div>

    <div class="bc-content">
      <div class="bc-compose">
        <el-card>
          <template #header>
            <span>{{ t('broadcast.sendBroadcast') }}</span>
          </template>
          <el-form label-width="80px">
            <el-form-item :label="t('broadcast.scope')">
              <el-select v-model="targetType" style="width: 100%">
                <el-option :label="t('broadcast.allSchool')" value="school" />
                <el-option :label="t('broadcast.byGrade')" value="grade" />
                <el-option :label="t('broadcast.byClass')" value="class" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="targetType !== 'school'" :label="t('broadcast.targetNodes')">
              <el-tree-select
                v-model="selectedTargetNodes"
                :data="orgTreeData"
                :props="{ label: 'name', children: 'children' }"
                :render-after-expand="false"
                check-strictly
                multiple
                show-checkbox
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item :label="t('broadcast.title1')">
              <el-input v-model="broadcastTitle" :placeholder="t('broadcast.titlePlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('broadcast.content')">
              <el-input
                v-model="broadcastContent"
                type="textarea"
                :rows="5"
                :placeholder="t('broadcast.contentPlaceholder')"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :disabled="!canSend" @click="handleSendBroadcast">
                <el-icon><Promotion /></el-icon>
                {{ t('broadcast.send') }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>

      <div class="bc-list">
        <h3>{{ t('broadcast.broadcastList') }}</h3>
        <div v-if="broadcasts.length === 0" class="bc-empty">
          <el-empty :description="t('broadcast.noBroadcasts')" />
        </div>
        <el-card
          v-for="b in broadcasts"
          :key="b.id"
          :class="['broadcast-item', { unread: !b.read }]"
          shadow="hover"
        >
          <div class="broadcast-header">
            <div class="broadcast-sender">
              <el-icon><Bell /></el-icon>
              <span class="sender-name">{{ b.senderName }}</span>
              <el-tag v-if="!b.read" type="danger" size="small">{{ t('broadcast.unread') }}</el-tag>
            </div>
            <span class="broadcast-time">{{ formatDate(b.timestamp) }}</span>
          </div>
          <h4 class="broadcast-title">{{ b.title }}</h4>
          <p class="broadcast-content">{{ b.content }}</p>
          <div v-if="b.attachments?.length" class="broadcast-attachments">
            <el-tag
              v-for="att in b.attachments"
              :key="att.name"
              closable
              @click="handleDownload(att)"
              type="info"
            >
              {{ att.name }}
            </el-tag>
          </div>
          <div class="broadcast-footer">
            <el-button v-if="!b.read" size="small" @click="markRead(b)">{{ t('broadcast.markRead') }}</el-button>
            <span v-if="b.readCount !== undefined" class="receipt-info">
              {{ t('broadcast.readCount', { read: b.readCount, total: b.totalCount }) }}
            </span>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Promotion, Bell } from '@element-plus/icons-vue'
import { useI18n } from '@/composables/useI18n'
import { useOrgStore } from '@/stores/org'

const { t } = useI18n()
const orgStore = useOrgStore()

const targetType = ref('school')
const selectedTargetNodes = ref([])
const broadcastTitle = ref('')
const broadcastContent = ref('')
const broadcasts = ref([])

const currentUsername = ref('')

const orgTreeData = computed(() => {
  if (!orgStore.tree) return []
  return [orgStore.tree]
})

const canSend = computed(() => {
  if (!broadcastTitle.value.trim() || !broadcastContent.value.trim()) return false
  if (targetType.value !== 'school' && selectedTargetNodes.value.length === 0) return false
  return true
})

async function handleSendBroadcast() {
  if (!window.electronAPI?.broadcast) return
  const targetNodeIds = targetType.value === 'school'
    ? [orgStore.tree?.id || 'root']
    : selectedTargetNodes.value

  const res = await window.electronAPI.broadcast.send({
    senderId: currentUsername.value,
    targetNodeIds,
    title: broadcastTitle.value.trim(),
    content: broadcastContent.value.trim(),
    attachments: []
  })

  if (res.success !== false) {
    ElMessage.success(t('broadcast.sendSuccess'))
    broadcastTitle.value = ''
    broadcastContent.value = ''
    selectedTargetNodes.value = []
    await loadBroadcasts()
  } else {
    ElMessage.error(res.message || t('broadcast.sendFailed'))
  }
}

async function loadBroadcasts() {
  if (!window.electronAPI?.broadcast) return
  const res = await window.electronAPI.broadcast.list(currentUsername.value)
  if (res.success !== false) {
    broadcasts.value = (res.broadcasts || []).sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    )
  }
}

async function markRead(broadcast) {
  if (!window.electronAPI?.broadcast) return
  await window.electronAPI.broadcast.markRead({
    broadcastId: broadcast.id,
    username: currentUsername.value
  })
  broadcast.read = true
}

function handleDownload(att) {}

function formatDate(timestamp) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

onMounted(async () => {
  const user = localStorage.getItem('userInfo')
  if (user) currentUsername.value = JSON.parse(user).username
  if (orgStore.tree) await loadBroadcasts()
})

defineExpose({ loadBroadcasts })
</script>

<style lang="scss" scoped>
.broadcast-center {
  padding: 30px;
  max-width: 900px;
  margin: 0 auto;

  .bc-header h2 { margin: 0 0 24px; color: var(--text-primary); }

  .bc-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .bc-compose {
    :deep(.el-card__body) { padding: 20px; }
  }

  .bc-list {
    h3 { margin: 0 0 16px; color: var(--text-primary); }

    .broadcast-item {
      margin-bottom: 12px;

      &.unread { border-left: 3px solid var(--accent-color); }

      .broadcast-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .broadcast-sender {
          display: flex;
          align-items: center;
          gap: 6px;
          .sender-name { font-weight: 500; color: var(--accent-color); }
        }
        .broadcast-time { font-size: 12px; color: var(--text-secondary); }
      }

      .broadcast-title { margin: 0 0 8px; font-size: 16px; color: var(--text-primary); }
      .broadcast-content { color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px; }
      .broadcast-attachments { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
      .broadcast-footer { display: flex; justify-content: space-between; align-items: center; }

      .receipt-info { font-size: 12px; color: var(--text-secondary); }
    }
  }
}
</style>

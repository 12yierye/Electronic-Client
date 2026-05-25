<template>
  <div class="file-manager-view">
    <div class="file-header">
      <h2>{{ t('files.title') }}</h2>
    </div>

    <div class="file-uploader">
      <el-upload
        ref="uploadRef"
        class="upload-area"
        drag
        multiple
        :auto-upload="false"
        :on-change="handleFileChange"
        :file-list="uploadFileList"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          {{ t('files.dropOrClick') }}
        </div>
      </el-upload>
    </div>

    <div class="file-list">
      <h3>{{ t('files.savedFiles') }}</h3>

      <el-table
        :data="sortedFiles"
        stripe
        style="width: 100%"
        :empty-text="t('files.noSavedFiles')"
      >
        <el-table-column prop="name" :label="t('files.fileName')" min-width="200">
          <template #default="{ row }">
            <div class="file-name-cell">
              <el-icon><Document /></el-icon>
              <span>{{ row.name }}</span>
              <el-tag v-if="row.uploader === currentUsername" size="small" type="success" effect="plain" class="self-tag">
                {{ t('files.self') }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="uploader" :label="t('files.publisher')" width="130">
          <template #default="{ row }">
            <span :class="{ 'is-self': row.uploader === currentUsername }">{{ row.uploader }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="size" :label="t('files.size')" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>

        <el-table-column prop="uploadTime" :label="t('files.publishTime')" width="170">
          <template #default="{ row }">
            {{ formatDate(row.uploadTime) }}
          </template>
        </el-table-column>

        <el-table-column :label="t('files.actions')" width="120" fixed="right">
          <template #default="{ row }">
            <template v-if="row.uploader === currentUsername">
              <el-button
                size="small"
                type="danger"
                @click="handleDelete(row)"
              >
                <el-icon><Delete /></el-icon>
                {{ t('files.delete') }}
              </el-button>
            </template>
            <template v-else>
              <el-button
                size="small"
                type="primary"
                @click="handleDownload(row)"
                :loading="downloadingFiles.includes(row.name + row.uploader)"
              >
                <template v-if="downloadProgress[row.name + row.uploader] !== undefined">
                  {{ downloadProgress[row.name + row.uploader] }}%
                </template>
                <template v-else>
                  <el-icon><Download /></el-icon>
                  {{ t('files.download') }}
                </template>
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { UploadFilled, Document, Download, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from '../../composables/useI18n'

const { t } = useI18n()

const uploadRef = ref(null)
const allFiles = ref([])
const uploadFileList = ref([])
const downloadingFiles = ref([])
const downloadProgress = ref({})
const currentUsername = ref('')
let refreshTimer = null

const sortedFiles = computed(() => {
  return [...allFiles.value].sort((a, b) => {
    const ta = a.uploadTime ? new Date(a.uploadTime).getTime() : 0
    const tb = b.uploadTime ? new Date(b.uploadTime).getTime() : 0
    return tb - ta
  })
})

onMounted(() => {
  const user = localStorage.getItem('userInfo')
  if (user) {
    currentUsername.value = JSON.parse(user).username
  }
  loadAllFiles()
  refreshTimer = setInterval(loadAllFiles, 10000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

const loadAllFiles = async () => {
  if (!window.electronAPI) return
  try {
    const result = await window.electronAPI.getAllFiles()
    if (result.success) {
      allFiles.value = result.files || []
    }
  } catch (_) {}
}

const handleFileChange = async (file, uploadFiles) => {
  uploadFileList.value = uploadFiles

  for (const f of uploadFiles) {
    if (window.electronAPI && f.raw) {
      try {
        const result = await window.electronAPI.uploadFile(
          currentUsername.value,
          f.name,
          await f.raw.arrayBuffer()
        )
        if (result.success) {
          ElMessage.success(t('files.uploadSuccess', { name: f.name }))
        } else {
          ElMessage.error(result.message)
        }
      } catch (error) {
        ElMessage.error(t('files.uploadFailed', { error: error.message }))
      }
    }
  }

  uploadFileList.value = []
  await loadAllFiles()
}

const handleDownload = async (file) => {
  if (file.uploader === currentUsername) {
    ElMessage.warning(t('files.cannotDownloadSelf'))
    return
  }
  if (!window.electronAPI) return

  const downloadKey = file.name + file.uploader
  downloadingFiles.value.push(downloadKey)
  downloadProgress.value[downloadKey] = 0

  if (window.electronAPI && window.electronAPI.onDownloadProgress) {
    window.electronAPI.onDownloadProgress((data) => {
      if (data.filename === file.name) {
        downloadProgress.value[downloadKey] = data.percentCompleted
      }
    })
  }

  try {
    const result = await window.electronAPI.downloadFile(file.uploader, file.name)
    if (result.success) {
      ElMessage.success(t('files.downloadSuccess'))
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    ElMessage.error(t('files.downloadFailed', { error: error.message }))
  } finally {
    downloadingFiles.value = downloadingFiles.value.filter(f => f !== downloadKey)
    delete downloadProgress.value[downloadKey]
  }
}

const handleDelete = async (file) => {
  try {
    await ElMessageBox.confirm(
      t('common.confirmDelete', { name: file.name }),
      t('common.warning'),
      { confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning' }
    )

    if (window.electronAPI) {
      const result = await window.electronAPI.deleteFile(currentUsername.value, file.name)
      if (result.success) {
        ElMessage.success(t('files.deleteSuccess'))
        await loadAllFiles()
      } else {
        ElMessage.error(result.message)
      }
    }
  } catch {}
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style lang="scss" scoped>
.file-manager-view {
  padding: 30px;
  max-width: 1000px;
  margin: 0 auto;

  .file-header {
    margin-bottom: 30px;

    h2 {
      margin: 0;
      color: var(--text-primary);
    }
  }

  .file-uploader {
    margin-bottom: 30px;

    .upload-area {
      :deep(.el-upload-dragger) {
        padding: 40px;
        background: var(--bg-secondary);
        border-color: var(--text-secondary);

        &:hover {
          border-color: var(--accent-color);
        }

        .el-icon--upload {
          font-size: 60px;
          color: var(--accent-color);
        }
      }
    }
  }

  .file-list {
    h3 {
      margin: 0 0 20px;
      color: var(--text-primary);
    }

    .file-name-cell {
      display: flex;
      align-items: center;
      gap: 8px;

      .self-tag {
        flex-shrink: 0;
      }
    }

    .is-self {
      color: var(--accent-color);
      font-weight: 500;
    }
  }
}
</style>
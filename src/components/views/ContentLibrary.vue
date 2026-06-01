<template>
  <div class="content-library">
    <div class="cl-header">
      <h2>内容库</h2>
      <el-input v-model="searchQuery" placeholder="搜索课件..." clearable style="width:240px" />
    </div>

    <div v-if="filteredFiles.length === 0" class="cl-empty">
      <el-empty description="暂无生成的课件" />
    </div>

    <div class="cl-grid" v-else>
      <el-card v-for="f in filteredFiles" :key="f.path" class="cl-card" shadow="hover">
        <div class="cl-card-icon">
          <el-icon :size="40"><Document /></el-icon>
        </div>
        <div class="cl-card-body">
          <div class="cl-card-name">{{ f.topic }}</div>
          <div class="cl-card-meta">
            <el-tag size="small" :type="f.type === 'pptx' ? 'warning' : 'info'">{{ f.type?.toUpperCase() || 'PPTX' }}</el-tag>
            <span>{{ f.slideCount || 0 }} 页</span>
            <span>·</span>
            <span>{{ formatSize(f.pptxSize || f.size || 0) }}</span>
            <span>·</span>
            <span>{{ formatDate(f.createdAt) }}</span>
          </div>
          <div class="cl-card-actions">
            <el-button size="small" @click="openFile(f.pptxPath)">打开</el-button>
            <el-button size="small" type="danger" @click="deleteFile(f)">删除</el-button>
          </div>
        </div>
      </el-card>
    </div>

    <div class="cl-footer">
      <el-button @click="refreshFiles" :icon="RefreshRight">刷新</el-button>
      <span class="cl-count">共 {{ filteredFiles.length }} 个课件</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Document, RefreshRight } from '@element-plus/icons-vue'

const files = ref([])
const searchQuery = ref('')

const filteredFiles = computed(() => {
  if (!searchQuery.value) return files.value
  const q = searchQuery.value.toLowerCase()
  return files.value.filter(f => f.topic?.toLowerCase().includes(q))
})

async function refreshFiles() {
  if (!window.electronAPI?.getPPTDir) return
  const dirRes = await window.electronAPI.getPPTDir()
  if (!dirRes.success || !dirRes.dir) return

  try {
    const result = await window.electronAPI.scanDirectory(dirRes.dir)
    if (result.success) {
      files.value = result.files || []
    }
  } catch {}
}

async function openFile(path) {
  if (window.electronAPI?.openFilePath) {
    await window.electronAPI.openFilePath(path)
  }
}

async function deleteFile(file) {
  try {
    await ElMessageBox.confirm(`确定删除 "${file.topic}"？`, '确认', { type: 'warning' })
    if (window.electronAPI?.deleteFile && file.pptxPath) {
      await window.electronAPI.deleteFile('_system_', file.pptxPath.split(/[\\/]/).pop())
    }
    await refreshFiles()
  } catch {}
}

function formatDate(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

onMounted(() => {
  refreshFiles()
})
</script>

<style lang="scss" scoped>
.content-library {
  padding: 30px;
  max-width: 1000px;
  margin: 0 auto;

  .cl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;

    h2 { margin: 0; color: var(--text-primary); }
  }

  .cl-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .cl-card {
    cursor: pointer;
    transition: transform 0.15s;

    &:hover { transform: translateY(-2px); }

    :deep(.el-card__body) {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
    }
  }

  .cl-card-icon {
    color: #d24726;
    flex-shrink: 0;
  }

  .cl-card-body {
    flex: 1;
    min-width: 0;
  }

  .cl-card-name {
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 4px;
  }

  .cl-card-meta {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    display: flex;
    gap: 6px;
  }

  .cl-card-actions {
    display: flex;
    gap: 8px;
  }

  .cl-empty {
    padding: 60px 0;
  }

  .cl-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .cl-count {
    font-size: 13px;
    color: var(--text-secondary);
  }
}
</style>

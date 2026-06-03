<template>
  <div class="content-library">
    <div class="cl-header">
      <h2>内容库</h2>
      <el-input v-model="searchQuery" placeholder="搜索课件..." clearable style="width:240px" />
    </div>

    <div class="cl-tabs">
      <el-radio-group v-model="activeFilter" size="small" @change="onFilterChange">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="pptx">课件</el-radio-button>
        <el-radio-button value="docx">讲义</el-radio-button>
        <el-radio-button value="json">练习</el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="pagedFiles.length === 0" class="cl-empty">
      <el-empty :description="searchQuery || activeFilter !== 'all' ? '未找到匹配的课件' : '暂无生成的课件'" />
    </div>

    <div class="cl-grid" v-else>
      <el-card v-for="f in pagedFiles" :key="f.path" class="cl-card" shadow="hover">
        <div v-if="f.thumbnail" class="cl-thumb-wrapper">
          <img :src="f.thumbnail" class="cl-thumb" alt="preview" @error="$event.target.style.display='none'" />
        </div>
        <div v-else class="cl-card-icon" :style="{ color: typeColor(f.type) }">
          <el-icon :size="40"><component :is="typeIcon(f.type)" /></el-icon>
        </div>
        <div class="cl-card-body">
          <div class="cl-card-name">{{ f.topic }}</div>
          <div class="cl-card-meta">
            <el-tag size="small" :type="typeTag(f.type)">{{ f.type?.toUpperCase() || 'PPTX' }}</el-tag>
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

    <div class="cl-footer" v-if="allFilteredFiles.length > 0">
      <el-button @click="refreshFiles" :icon="RefreshRight">刷新</el-button>
      <span class="cl-count">共 {{ allFilteredFiles.length }} 个</span>
      <el-pagination
        v-if="totalPages > 1"
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="allFilteredFiles.length"
        layout="prev, pager, next"
        size="small"
        background
        class="cl-pagination"
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, RefreshRight, Notebook, Files, Collection } from '@element-plus/icons-vue'

const files = ref([])
const searchQuery = ref('')
const activeFilter = ref('all')
const currentPage = ref(1)
const pageSize = ref(12)

const allFilteredFiles = computed(() => {
  let result = files.value
  if (activeFilter.value !== 'all') {
    result = result.filter(f => {
      if (activeFilter.value === 'json') return (f.type || '').toLowerCase() === 'json'
      return (f.type || '').toLowerCase() === activeFilter.value
    })
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(f => f.topic?.toLowerCase().includes(q))
  }
  return result
})

const totalPages = computed(() => Math.max(1, Math.ceil(allFilteredFiles.value.length / pageSize.value)))

const pagedFiles = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return allFilteredFiles.value.slice(start, start + pageSize.value)
})

function onFilterChange() {
  currentPage.value = 1
}

function onPageChange() {}

function typeColor(type) {
  const t = (type || '').toLowerCase()
  if (t === 'pptx') return '#d24726'
  if (t === 'docx') return '#2b579a'
  if (t === 'json') return '#217346'
  return '#666'
}

function typeIcon(type) {
  const t = (type || '').toLowerCase()
  if (t === 'docx') return Notebook
  if (t === 'json') return Collection
  return Document
}

function typeTag(type) {
  const t = (type || '').toLowerCase()
  if (t === 'docx') return ''
  if (t === 'json') return 'success'
  return 'warning'
}

async function refreshFiles() {
  if (!window.electronAPI?.getPPTDir) return
  const dirRes = await window.electronAPI.getPPTDir()
  if (!dirRes.success || !dirRes.dir) return

  try {
    const result = await window.electronAPI.scanDirectory(dirRes.dir)
    if (result.success) {
      files.value = result.files || []
      currentPage.value = 1
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
    if (window.electronAPI?.deletePPTFile) {
      const result = await window.electronAPI.deletePPTFile({ pptxPath: file.pptxPath, metaPath: file.metaPath })
      if (result.success) {
        ElMessage.success(`"${file.topic}" 已删除`)
      } else {
        ElMessage.error(`删除失败: ${result.message}`)
      }
    }
    await refreshFiles()
  } catch {
    // 用户取消确认
  }
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
    margin-bottom: 16px;

    h2 { margin: 0; color: var(--text-primary); }
  }

  .cl-tabs {
    margin-bottom: 20px;
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
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
    }
  }

  .cl-thumb-wrapper {
    flex-shrink: 0;
    width: 80px;
    height: 60px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-secondary);

    .cl-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .cl-card-icon {
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
    align-items: center;
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
    flex: 1;
  }

  .cl-pagination {
    margin-left: auto;
  }
}
</style>

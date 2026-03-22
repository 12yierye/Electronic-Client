<<<<<<< HEAD
<template>
  <div class="file-manager-view">
    <div class="file-header">
      <h2>文件管理</h2>
    </div>
    
    <!-- 拖放区域 -->
    <el-upload
      ref="uploadRef"
      class="file-uploader"
      drag
      multiple
      :auto-upload="false"
      :on-change="handleFileChange"
      :file-list="fileList"
    >
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">
        将文件拖放到此处或点击上传
      </div>
    </el-upload>
    
    <!-- 文件列表 -->
    <div class="file-list">
      <h3>已保存文件</h3>
      
      <el-table :data="files" stripe style="width: 100%">
        <el-table-column prop="name" label="文件名" min-width="200">
          <template #default="{ row }">
            <div class="file-name-cell">
              <el-icon><Document /></el-icon>
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="size" label="大小" width="120">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="lastModified" label="日期" width="180">
          <template #default="{ row }">
            {{ formatDate(row.lastModified) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button 
              size="small" 
              type="primary" 
              @click="handleDownload(row)"
              :loading="downloadingFiles.includes(row.name)"
            >
              <el-icon><Download /></el-icon>
              下载
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="handleDelete(row)"
            >
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <el-empty v-if="files.length === 0" description="暂无已保存文件" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { UploadFilled, Document, Download, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const uploadRef = ref(null)
const files = ref([])
const fileList = ref([])
const downloadingFiles = ref([])
const currentUsername = ref('')

const STORAGE_KEY = 'uploadedFiles'

// 初始化
onMounted(() => {
  const user = localStorage.getItem('userInfo')
  if (user) {
    currentUsername.value = JSON.parse(user).username
  }
  loadFilesFromStorage()
})

// 加载文件列表
const loadFilesFromStorage = () => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    files.value = JSON.parse(stored)
  }
}

// 保存到本地存储
const saveToStorage = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files.value))
}

// 处理文件上传
const handleFileChange = async (file, uploadFiles) => {
  fileList.value = uploadFiles
  
  for (const f of uploadFiles) {
    const fileInfo = {
      name: f.name,
      size: f.size,
      type: f.raw?.type || '',
      lastModified: f.raw?.lastModified || Date.now()
    }
    
    // 检查是否已存在
    const exists = files.value.some(fi => fi.name === fileInfo.name)
    if (exists) {
      try {
        await ElMessageBox.confirm(
          `文件已存在: ${fileInfo.name}`,
          '确认',
          { confirmButtonText: '替换', cancelButtonText: '跳过' }
        )
        // 替换
        files.value = files.value.filter(fi => fi.name !== fileInfo.name)
        files.value.push(fileInfo)
      } catch {
        // 跳过
        continue
      }
    } else {
      files.value.push(fileInfo)
    }
    
    // 上传到服务器
    if (window.electronAPI && f.raw) {
      try {
        await window.electronAPI.uploadFile(
          currentUsername.value,
          fileInfo.name,
          await f.raw.arrayBuffer()
        )
        ElMessage.success(`上传成功: ${fileInfo.name}`)
      } catch (error) {
        ElMessage.error(`上传失败: ${error.message}`)
      }
    }
  }
  
  saveToStorage()
  fileList.value = []
}

// 下载文件
const handleDownload = async (file) => {
  if (!window.electronAPI) return
  
  downloadingFiles.value.push(file.name)
  
  try {
    const result = await window.electronAPI.downloadFile(currentUsername.value, file.name)
    if (result.success) {
      ElMessage.success('下载成功')
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    downloadingFiles.value = downloadingFiles.value.filter(f => f !== file.name)
  }
}

// 删除文件
const handleDelete = async (file) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${file.name}?`,
      '警告',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    )
    
    if (window.electronAPI) {
      const result = await window.electronAPI.deleteFile(currentUsername.value, file.name)
      if (result.success) {
        files.value = files.value.filter(f => f.name !== file.name)
        saveToStorage()
        ElMessage.success('删除成功')
      } else {
        ElMessage.error(result.message)
      }
    }
  } catch {
    // 取消删除
  }
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (timestamp) => {
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
  
  .file-list {
    h3 {
      margin: 0 0 20px;
      color: var(--text-primary);
    }
    
    .file-name-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}
</style>
=======
<template>
  <div class="file-manager-view">
    <div class="file-header">
      <h2>文件管理</h2>
    </div>
    
    <!-- 拖放区域 -->
    <el-upload
      ref="uploadRef"
      class="file-uploader"
      drag
      multiple
      :auto-upload="false"
      :on-change="handleFileChange"
      :file-list="fileList"
    >
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">
        将文件拖放到此处或点击上传
      </div>
    </el-upload>
    
    <!-- 文件列表 -->
    <div class="file-list">
      <h3>已保存文件</h3>
      
      <el-table :data="files" stripe style="width: 100%">
        <el-table-column prop="name" label="文件名" min-width="200">
          <template #default="{ row }">
            <div class="file-name-cell">
              <el-icon><Document /></el-icon>
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="size" label="大小" width="120">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="lastModified" label="日期" width="180">
          <template #default="{ row }">
            {{ formatDate(row.lastModified) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button 
              size="small" 
              type="primary" 
              @click="handleDownload(row)"
              :loading="downloadingFiles.includes(row.name)"
            >
              <el-icon><Download /></el-icon>
              下载
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="handleDelete(row)"
            >
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <el-empty v-if="files.length === 0" description="暂无已保存文件" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { UploadFilled, Document, Download, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const uploadRef = ref(null)
const files = ref([])
const fileList = ref([])
const downloadingFiles = ref([])
const currentUsername = ref('')

const STORAGE_KEY = 'uploadedFiles'

// 初始化
onMounted(() => {
  const user = localStorage.getItem('userInfo')
  if (user) {
    currentUsername.value = JSON.parse(user).username
  }
  loadFilesFromStorage()
})

// 加载文件列表
const loadFilesFromStorage = () => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    files.value = JSON.parse(stored)
  }
}

// 保存到本地存储
const saveToStorage = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files.value))
}

// 处理文件上传
const handleFileChange = async (file, uploadFiles) => {
  fileList.value = uploadFiles
  
  for (const f of uploadFiles) {
    const fileInfo = {
      name: f.name,
      size: f.size,
      type: f.raw?.type || '',
      lastModified: f.raw?.lastModified || Date.now()
    }
    
    // 检查是否已存在
    const exists = files.value.some(fi => fi.name === fileInfo.name)
    if (exists) {
      try {
        await ElMessageBox.confirm(
          `文件已存在: ${fileInfo.name}`,
          '确认',
          { confirmButtonText: '替换', cancelButtonText: '跳过' }
        )
        // 替换
        files.value = files.value.filter(fi => fi.name !== fileInfo.name)
        files.value.push(fileInfo)
      } catch {
        // 跳过
        continue
      }
    } else {
      files.value.push(fileInfo)
    }
    
    // 上传到服务器
    if (window.electronAPI && f.raw) {
      try {
        await window.electronAPI.uploadFile(
          currentUsername.value,
          fileInfo.name,
          await f.raw.arrayBuffer()
        )
        ElMessage.success(`上传成功: ${fileInfo.name}`)
      } catch (error) {
        ElMessage.error(`上传失败: ${error.message}`)
      }
    }
  }
  
  saveToStorage()
  fileList.value = []
}

// 下载文件
const handleDownload = async (file) => {
  if (!window.electronAPI) return
  
  downloadingFiles.value.push(file.name)
  
  try {
    const result = await window.electronAPI.downloadFile(currentUsername.value, file.name)
    if (result.success) {
      ElMessage.success('下载成功')
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    downloadingFiles.value = downloadingFiles.value.filter(f => f !== file.name)
  }
}

// 删除文件
const handleDelete = async (file) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${file.name}?`,
      '警告',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    )
    
    if (window.electronAPI) {
      const result = await window.electronAPI.deleteFile(currentUsername.value, file.name)
      if (result.success) {
        files.value = files.value.filter(f => f.name !== file.name)
        saveToStorage()
        ElMessage.success('删除成功')
      } else {
        ElMessage.error(result.message)
      }
    }
  } catch {
    // 取消删除
  }
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (timestamp) => {
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
  
  .file-list {
    h3 {
      margin: 0 0 20px;
      color: var(--text-primary);
    }
    
    .file-name-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}
</style>
>>>>>>> f3dad1cfcc8f087826bc135228a1a3df7c24437e

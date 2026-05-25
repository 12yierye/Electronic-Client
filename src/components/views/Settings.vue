<template>
  <div class="settings-view">
    <div class="settings-container">
      <h2>{{ t('settings.title') }}</h2>

      <!-- 主题设置 -->
      <el-form-item :label="t('settings.theme') + '：'">
        <el-radio-group v-model="theme" @change="handleThemeChange">
          <el-radio-button value="dark">
            <el-icon><Moon /></el-icon>
            {{ t('settings.dark') }}
          </el-radio-button>
          <el-radio-button value="light">
            <el-icon><Sunny /></el-icon>
            {{ t('settings.light') }}
          </el-radio-button>
          <el-radio-button value="auto">
            <el-icon><Monitor /></el-icon>
            {{ t('settings.auto') }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!-- 语言设置 -->
      <el-form-item :label="t('settings.language') + '：'">
        <div class="language-selector">
          <el-select
            v-model="language"
            :placeholder="t('settings.selectLanguage')"
            @change="handleLanguageChange"
          >
            <el-option
              v-for="lang in languages"
              :key="lang.code"
              :label="lang.flag + ' ' + lang.nativeName"
              :value="lang.code"
            >
              <span class="lang-option">
                <span class="lang-flag">{{ lang.flag }}</span>
                <span class="lang-name">{{ lang.nativeName }}</span>
              </span>
            </el-option>
          </el-select>
          <div class="language-tip">{{ t('settings.languageTip') }}</div>
        </div>
      </el-form-item>

      <!-- AI 模型设置 -->
      <el-divider />
      <h3>{{ t('settings.aiModelTitle') }}</h3>

      <el-form-item :label="t('settings.aiServerIP') + '：'">
        <el-input
          v-model="aiServerIP"
          :placeholder="t('settings.aiServerIPPlaceholder')"
          @blur="saveAiApiSettings"
        />
      </el-form-item>

      <el-form-item :label="t('settings.aiServerPort') + '：'">
        <el-input
          v-model="aiServerPort"
          :placeholder="t('settings.aiServerPortPlaceholder')"
          @blur="saveAiApiSettings"
        />
        <div class="setting-tip">{{ t('settings.aiServerTip') }}</div>
      </el-form-item>

      <!-- 服务端设置 -->
      <el-divider />
      <h3>{{ t('settings.serverTitle') }}</h3>
      
      <el-form-item :label="t('settings.serverIP') + '：'">
        <el-input
          v-model="serverIP"
          :placeholder="t('settings.serverIPPlaceholder')"
          @blur="saveServerSettings"
        />
        <div class="setting-tip">{{ t('settings.serverIPTip') }}</div>
      </el-form-item>
      
      <el-form-item :label="t('settings.serverPort') + '：'">
        <el-input
          v-model="serverPort"
          :placeholder="t('settings.serverPortPlaceholder')"
          @blur="saveServerSettings"
        />
      </el-form-item>
      
      <el-form-item>
        <el-button type="primary" @click="testServerConnection" :loading="testingServer">
          {{ testingServer ? t('settings.testing') : t('settings.testConnection') }}
        </el-button>
      </el-form-item>

      <!-- 好友搜索设置 -->
      <el-divider />
      <h3>{{ t('settings.friendSearchTitle') }}</h3>
      
      <el-form-item :label="t('settings.enablePinyinSearch') + '：'">
        <el-switch v-model="enablePinyinSearch" @change="savePinyinSearchSetting" />
        <div class="setting-tip">{{ t('settings.enablePinyinSearchTip') }}</div>
      </el-form-item>

      <!-- 下载目录设置 -->
      <el-divider />
      <h3>{{ t('settings.downloadTitle') }}</h3>

      <el-form-item :label="t('settings.downloadDir') + '：'">
        <div class="download-dir-row">
          <el-input
            v-model="downloadDir"
            :placeholder="t('settings.downloadDirPlaceholder')"
            @blur="handleDownloadDirBlur"
            @keyup.enter="handleDownloadDirEnter"
          />
          <el-button @click="handleSelectDir" :icon="FolderOpened" />
        </div>
        <div class="setting-tip">{{ t('settings.downloadDirTip') }}</div>
      </el-form-item>

      <!-- 关于 -->
      <el-divider />

      <div class="about-section">
        <h3>{{ t('settings.about') }}</h3>
        <p>{{ t('app.version') }}: 1.0.0</p>
        <p>{{ t('app.title') }} - {{ t('settings.description') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Moon, Sunny, Monitor, FolderOpened } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../../stores/settings'
import { useI18n } from '../../composables/useI18n'
import { languages } from '../../utils/i18n'

const settingsStore = useSettingsStore()
const { t, setLocale } = useI18n()

const theme = ref('dark')
const language = ref('zh-CN')
const serverIP = ref('127.0.0.1')
const serverPort = ref('3000')
const testingServer = ref(false)
const enablePinyinSearch = ref(false)

const AI_SETTINGS_KEY = 'aiApiSettings'

const aiServerIP = ref('127.0.0.1')
const aiServerPort = ref('1234')

const SERVER_SETTINGS_KEY = 'lanChatSettings'
const DOWNLOAD_DIR_KEY = 'downloadDir'

const downloadDir = ref('')

// 保存下载目录设置
const saveDownloadDir = () => {
  const dir = downloadDir.value.trim()
  localStorage.setItem(DOWNLOAD_DIR_KEY, dir)
  if (window.electronAPI?.setDownloadDir) {
    window.electronAPI.setDownloadDir(dir || null)
  }
}

const ensureDirExists = (dir) => {
  if (!dir) return
  try {
    if (window.electronAPI?.ensureDir) {
      window.electronAPI.ensureDir(dir)
    }
  } catch (_) {}
}

const handleDownloadDirBlur = () => {
  const dir = downloadDir.value.trim()
  if (!dir) return
  if (window.electronAPI?.ensureDir) {
    window.electronAPI.ensureDir(dir)
  }
  saveDownloadDir()
}

const handleDownloadDirEnter = () => {
  handleDownloadDirBlur()
}

const handleSelectDir = async () => {
  if (!window.electronAPI?.selectDirectory) return
  const result = await window.electronAPI.selectDirectory()
  if (result.success && result.dir) {
    downloadDir.value = result.dir
    saveDownloadDir()
  }
}

// 保存 AI API 设置到 localStorage 并同步到主进程
const saveAiApiSettings = () => {
  const ip = aiServerIP.value || '127.0.0.1'
  const port = aiServerPort.value || '1234'
  const apiUrl = `http://${ip}:${port}/v1`
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify({ ip, port }))
  if (window.electronAPI?.setAiApiUrl) {
    window.electronAPI.setAiApiUrl(apiUrl)
  }
}

// 初始化
onMounted(() => {
  theme.value = settingsStore.theme
  language.value = settingsStore.language || 'zh-CN'
  
  // 加载 AI API 设置
  const aiSettings = localStorage.getItem(AI_SETTINGS_KEY)
  if (aiSettings) {
    const s = JSON.parse(aiSettings)
    aiServerIP.value = s.ip || '127.0.0.1'
    aiServerPort.value = s.port || '1234'
  }
  // 启动时同步到主进程
  saveAiApiSettings()
  
  // 加载服务端设置（兼容旧版 key）
  const raw = localStorage.getItem(SERVER_SETTINGS_KEY)
  if (raw) {
    const s = JSON.parse(raw)
    serverIP.value = s.serverIP || s.lanServerIP || '127.0.0.1'
    serverPort.value = s.serverPort || s.lanServerPort || '3000'
    enablePinyinSearch.value = s.enablePinyinSearch || false
  }

  // 加载下载目录设置
  const savedDir = localStorage.getItem(DOWNLOAD_DIR_KEY)
  if (savedDir) {
    downloadDir.value = savedDir
    if (window.electronAPI?.setDownloadDir) {
      window.electronAPI.setDownloadDir(savedDir)
    }
  } else if (window.electronAPI?.getDownloadDir) {
    window.electronAPI.getDownloadDir().then(result => {
      if (result.success) {
        downloadDir.value = result.dir
      }
    })
  }
})

// 主题切换
const handleThemeChange = (value) => {
  settingsStore.toggleTheme(value)
}

// 语言切换
const handleLanguageChange = (value) => {
  setLocale(value)
}

// 保存服务端设置
const saveServerSettings = () => {
  const settings = {
    serverIP: serverIP.value,
    serverPort: serverPort.value,
    enablePinyinSearch: enablePinyinSearch.value
  }
  localStorage.setItem(SERVER_SETTINGS_KEY, JSON.stringify(settings))
}

// 保存拼音搜索设置
const savePinyinSearchSetting = () => {
  saveServerSettings()
}

// 测试服务端连接
const testServerConnection = async () => {
  if (!serverIP.value) {
    ElMessage.warning(t('settings.enterServerIP'))
    return
  }
  
  testingServer.value = true
  try {
    const response = await fetch(`http://${serverIP.value}:${serverPort.value}/health`, {
      method: 'GET'
    })
    if (response.ok) {
      ElMessage.success(t('settings.connectionSuccess'))
    } else {
      ElMessage.error(t('settings.connectionFailed'))
    }
  } catch (error) {
    ElMessage.error(t('settings.connectionError') + error.message)
  } finally {
    testingServer.value = false
  }
}
</script>

<style lang="scss" scoped>
.settings-view {
  padding: 30px;
  max-width: 600px;
  margin: 0 auto;

  .settings-container {
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 30px;

    h2 {
      margin: 0 0 30px;
      color: var(--text-primary);
    }

    .el-form-item {
      margin-bottom: 30px;

      :deep(.el-form-item__label) {
        color: var(--text-primary);
        font-weight: 500;
      }
    }

    .language-selector {
      width: 100%;

      .el-select {
        width: 200px;
      }

      .language-tip {
        margin-top: 8px;
        font-size: 12px;
        color: var(--text-secondary);
      }
    }

    .lang-option {
      display: flex;
      align-items: center;
      gap: 8px;

      .lang-flag {
        font-size: 18px;
      }

      .lang-name {
        font-size: 14px;
      }
    }
    
    h3 {
      margin: 0 0 20px;
      color: var(--text-primary);
    }
    
    .setting-tip {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 8px;
    }

    .download-dir-row {
      display: flex;
      gap: 8px;

      .el-input {
        flex: 1;
      }
    }

    .about-section {
      h3 {
        margin: 0 0 15px;
        color: var(--text-primary);
      }

      p {
        margin: 8px 0;
        color: var(--text-secondary);
      }
    }
  }
}
</style>

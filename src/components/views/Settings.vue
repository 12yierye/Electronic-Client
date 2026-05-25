<template>
  <div class="settings-view">
    <div class="settings-layout">
      <div class="settings-sidebar">
        <div
          v-for="item in navItems"
          :key="item.key"
          :class="['settings-nav-item', { active: activeNav === item.key }]"
          @click="activeNav = item.key"
        >
          <el-icon v-if="item.icon" class="nav-icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </div>
      </div>

      <div class="settings-content">
        <!-- 用户资料 -->
        <UserProfile v-if="activeNav === 'profile'" />

        <!-- 外观 -->
        <div v-else-if="activeNav === 'appearance'" class="settings-section">
          <h3>{{ t('settings.title') }}</h3>
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
              <div class="setting-tip">{{ t('settings.languageTip') }}</div>
            </div>
          </el-form-item>
        </div>

        <!-- AI 模型 -->
        <div v-else-if="activeNav === 'ai'" class="settings-section">
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
        </div>

        <!-- 服务端 -->
        <div v-else-if="activeNav === 'server'" class="settings-section">
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
        </div>

        <!-- 好友搜索 -->
        <div v-else-if="activeNav === 'friendSearch'" class="settings-section">
          <h3>{{ t('settings.friendSearchTitle') }}</h3>
          <el-form-item :label="t('settings.enablePinyinSearch') + '：'">
            <div class="switch-with-tip">
              <el-switch v-model="enablePinyinSearch" @change="savePinyinSearchSetting" />
              <div class="setting-tip">{{ t('settings.enablePinyinSearchTip') }}</div>
            </div>
          </el-form-item>
        </div>

        <!-- 下载目录 -->
        <div v-else-if="activeNav === 'download'" class="settings-section">
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
        </div>

        <!-- 关于 -->
        <div v-else-if="activeNav === 'about'" class="settings-section">
          <h3>{{ t('settings.about') }}</h3>
          <div class="about-section">
            <p>{{ t('app.version') }}: 1.0.0</p>
            <p>{{ t('app.title') }} - {{ t('settings.description') }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Moon, Sunny, Monitor, FolderOpened, User, Setting, MagicStick, Link, Search, Folder, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../../stores/settings'
import { useI18n } from '../../composables/useI18n'
import { languages } from '../../utils/i18n'
import UserProfile from './settings/UserProfile.vue'

const settingsStore = useSettingsStore()
const { t, setLocale } = useI18n()

const activeNav = ref('profile')

const navItems = [
    { key: 'profile', label: '用户资料', icon: User },
    { key: 'appearance', label: '外观', icon: Setting },
    { key: 'ai', label: 'AI 模型', icon: MagicStick },
    { key: 'server', label: '服务端', icon: Link },
    { key: 'friendSearch', label: '好友搜索', icon: Search },
    { key: 'download', label: '下载目录', icon: Folder },
    { key: 'about', label: '关于', icon: InfoFilled }
]

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
function getCurrentUsername() {
    try {
        const user = localStorage.getItem('userInfo')
        return user ? JSON.parse(user).username : ''
    } catch {
        return ''
    }
}

function getDownloadDirKey() {
    const username = getCurrentUsername()
    return username ? `downloadDir_${username}` : 'downloadDir'
}

const downloadDir = ref('')

const saveDownloadDir = () => {
    const dir = downloadDir.value.trim()
    const key = getDownloadDirKey()
    localStorage.setItem(key, dir)
    if (window.electronAPI?.setDownloadDir) {
        window.electronAPI.setDownloadDir(dir || null)
    }
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

const saveAiApiSettings = () => {
    const ip = aiServerIP.value || '127.0.0.1'
    const port = aiServerPort.value || '1234'
    const apiUrl = `http://${ip}:${port}/v1`
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify({ ip, port }))
    if (window.electronAPI?.setAiApiUrl) {
        window.electronAPI.setAiApiUrl(apiUrl)
    }
}

onMounted(() => {
    theme.value = settingsStore.theme
    language.value = settingsStore.language || 'zh-CN'

    const aiSettings = localStorage.getItem(AI_SETTINGS_KEY)
    if (aiSettings) {
        const s = JSON.parse(aiSettings)
        aiServerIP.value = s.ip || '127.0.0.1'
        aiServerPort.value = s.port || '1234'
    }
    saveAiApiSettings()

    const raw = localStorage.getItem(SERVER_SETTINGS_KEY)
    if (raw) {
        const s = JSON.parse(raw)
        serverIP.value = s.serverIP || s.lanServerIP || '127.0.0.1'
        serverPort.value = s.serverPort || s.lanServerPort || '3000'
        enablePinyinSearch.value = s.enablePinyinSearch || false
    }

    const savedDir = localStorage.getItem(getDownloadDirKey())
    if (savedDir) {
        downloadDir.value = savedDir
        if (window.electronAPI?.setDownloadDir) {
            window.electronAPI.setDownloadDir(savedDir)
        }
    } else if (window.electronAPI?.getDownloadDir) {
        window.electronAPI.getDownloadDir().then((result) => {
            if (result.success) {
                downloadDir.value = result.dir
            }
        })
    }
})

const handleThemeChange = (value) => {
    settingsStore.toggleTheme(value)
}

const handleLanguageChange = (value) => {
    setLocale(value)
}

const saveServerSettings = () => {
    const settings = {
        serverIP: serverIP.value,
        serverPort: serverPort.value,
        enablePinyinSearch: enablePinyinSearch.value
    }
    localStorage.setItem(SERVER_SETTINGS_KEY, JSON.stringify(settings))
}

const savePinyinSearchSetting = () => {
    saveServerSettings()
}

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
    height: calc(100vh - 60px);
    padding: 0;

    .settings-layout {
        display: flex;
        height: 100%;

        .settings-sidebar {
            width: 200px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border-color);
            padding: 16px 0;
            overflow-y: auto;
            flex-shrink: 0;

            .settings-nav-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 20px;
                cursor: pointer;
                color: var(--text-secondary);
                transition: all 0.2s;
                font-size: 14px;

                .nav-icon {
                    font-size: 18px;
                }

                &:hover {
                    background: rgba(52, 152, 219, 0.08);
                    color: var(--text-primary);
                }

                &.active {
                    background: rgba(52, 152, 219, 0.15);
                    color: var(--accent-color);
                    font-weight: 500;
                    border-right: 3px solid var(--accent-color);
                }
            }
        }

        .settings-content {
            flex: 1;
            padding: 30px 40px;
            overflow-y: auto;
            background: var(--bg-primary);

            .settings-section {
                max-width: 600px;

                h3 {
                    margin: 0 0 24px;
                    color: var(--text-primary);
                }

                .el-form-item {
                    margin-bottom: 24px;

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
                    p {
                        margin: 8px 0;
                        color: var(--text-secondary);
                    }
                }

                .switch-with-tip {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
            }
        }
    }
}
</style>
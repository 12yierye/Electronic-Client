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

          <el-form-item :label="t('settings.useSystemBrowser') + '：'">
            <div class="switch-with-tip">
              <el-switch v-model="useSystemBrowser" @change="handleUseSystemBrowserChange" />
              <div class="setting-tip">{{ t('settings.useSystemBrowserTip') }}</div>
            </div>
          </el-form-item>
        </div>

        <!-- 聊天设置 -->
        <div v-else-if="activeNav === 'chat'" class="settings-section">
          <h3>{{ t('settings.chatTitle') }}</h3>
          <el-form-item :label="t('settings.sendKey') + '：'">
            <el-radio-group v-model="sendKey" @change="handleSendKeyChange">
              <el-radio-button value="Enter">Enter</el-radio-button>
              <el-radio-button value="Ctrl+Enter">Ctrl + Enter</el-radio-button>
            </el-radio-group>
            <div class="setting-tip">{{ t('settings.sendKeyTip') }}</div>
          </el-form-item>
          <el-form-item :label="t('settings.friendListDensity') + '：'">
            <el-radio-group v-model="friendListDensity" @change="handleFriendListDensityChange">
              <el-radio-button value="compact">{{ t('settings.compact') }}</el-radio-button>
              <el-radio-button value="relaxed">{{ t('settings.relaxed') }}</el-radio-button>
            </el-radio-group>
            <div class="setting-tip">{{ t('settings.friendListDensityTip') }}</div>
          </el-form-item>
          <el-divider />
          <el-form-item :label="t('settings.navFlashIntensity') + '：'">
            <el-radio-group v-model="navFlashIntensity" @change="handleNavFlashIntensityChange">
              <el-radio-button value="off">{{ t('settings.flashOff') }}</el-radio-button>
              <el-radio-button value="low">{{ t('settings.flashLow') }}</el-radio-button>
              <el-radio-button value="medium">{{ t('settings.flashMedium') }}</el-radio-button>
              <el-radio-button value="high">{{ t('settings.flashHigh') }}</el-radio-button>
            </el-radio-group>
            <div class="setting-tip">{{ t('settings.navFlashIntensityTip') }}</div>
          </el-form-item>
          <el-divider />
          <el-form-item :label="t('settings.cacheRetentionDays') + '：'">
            <el-select v-model="cacheRetentionDays" @change="handleCacheRetentionDaysChange" style="width: 180px">
              <el-option v-for="d in cacheDayOptions" :key="d" :label="t('settings.cacheDaysOption', { n: d })" :value="d" />
            </el-select>
            <div class="setting-tip">{{ t('settings.cacheRetentionDaysTip') }}</div>
          </el-form-item>
          <el-divider />
          <el-form-item :label="t('settings.unreadBadgeDisplay') + '：'">
            <div class="badge-settings-list">
              <div class="badge-setting-row">
                <div class="switch-with-label">
                  <el-switch v-model="showModeUnreadBadge" @change="handleShowModeUnreadBadgeChange" />
                  <span class="badge-label">{{ t('settings.showModeUnreadBadge') }}</span>
                </div>
                <div class="setting-tip-inline">{{ t('settings.showModeUnreadBadgeTip') }}</div>
              </div>
              <div class="badge-setting-row">
                <div class="switch-with-label">
                  <el-switch v-model="showTabUnreadBadge" @change="handleShowTabUnreadBadgeChange" />
                  <span class="badge-label">{{ t('settings.showTabUnreadBadge') }}</span>
                </div>
                <div class="setting-tip-inline">{{ t('settings.showTabUnreadBadgeTip') }}</div>
              </div>
            </div>
          </el-form-item>
        </div>

        <!-- AI 模型 -->
        <div v-else-if="activeNav === 'ai'" class="settings-section">
          <h3>{{ t('settings.aiModelTitle') }}</h3>
          <el-form-item :label="t('settings.aiMode') + '：'">
            <el-radio-group v-model="aiSettingsMode" @change="saveAiMode">
              <el-radio-button value="local">{{ t('settings.aiModeLocal') }}</el-radio-button>
              <el-radio-button value="cloud">{{ t('settings.aiModeCloud') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="上下文长度：">
            <el-slider v-model="contextTokens" :min="1000" :max="maxContextLimit" :step="1000" show-input @change="saveContextTokens" />
            <div class="setting-tip">对话上下文最大 token 数。当前模型上限 {{ maxContextLimit.toLocaleString() }}。越大则 AI 能记住越多历史。</div>
          </el-form-item>
          <el-divider />

          <!-- 本地模型 -->
          <div v-show="aiSettingsMode === 'local'">
            <h4>{{ t('settings.localModel') }}</h4>
            <el-form-item :label="t('settings.aiServerIP') + '：'">
              <el-input v-model="aiServerIP" :placeholder="t('settings.aiServerIPPlaceholder')" @blur="saveAiApiSettings" />
            </el-form-item>
            <el-form-item :label="t('settings.aiServerPort') + '：'">
              <el-input v-model="aiServerPort" :placeholder="t('settings.aiServerPortPlaceholder')" @blur="saveAiApiSettings" />
            </el-form-item>
            <div class="setting-tip">{{ t('settings.aiServerTip') }}</div>
          </div>

          <!-- 云端 API -->
          <div v-show="aiSettingsMode === 'cloud'">
            <h4>{{ t('settings.cloudModel') }}</h4>
            <el-form-item :label="t('settings.cloudProvider') + '：'">
              <el-select v-model="cloudProviderId" placeholder="选择提供商" @change="handleProviderChange" style="width:100%">
                <el-option v-for="p in providerList" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('settings.cloudModelName') + '：'">
              <el-select v-if="cloudProviderId !== 'custom'" v-model="cloudModel" placeholder="选择模型" style="width:100%">
                <el-option v-for="m in currentProviderModels" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
              <el-input v-else v-model="cloudModel" placeholder="输入模型标识符" />
            </el-form-item>
            <el-form-item v-if="cloudProviderId === 'custom'" :label="t('settings.cloudApiBase') + '：'">
              <el-input v-model="cloudApiBase" placeholder="https://api.openai.com/v1" />
            </el-form-item>
            <el-form-item :label="t('settings.cloudApiKey') + '：'">
              <el-input v-model="cloudApiKey" type="password" placeholder="sk-..." show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveCloudApiSettings">{{ t('common.save') }}</el-button>
            </el-form-item>
            <div class="setting-tip">支持所有 OpenAI 兼容接口（DeepSeek、通义千问、智谱等）。选择提供商后自动填充地址和模型列表。</div>
          </div>
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

        <!-- 课件模板 -->
        <div v-else-if="activeNav === 'templates'" class="settings-section">
          <h3>课件模板</h3>
          <el-form-item label="当前模板：">
            <el-select v-model="activeTemplate" @change="applyTemplate" style="width:100%">
              <el-option v-for="t in templateList" :key="t.id" :label="t.name" :value="t.id" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button @click="showAddTemplate = true" :icon="Plus">新建模板</el-button>
          </el-form-item>

          <el-dialog v-model="showAddTemplate" title="新建模板" width="360px">
            <el-form label-width="70px">
              <el-form-item label="名称"><el-input v-model="newTemplateName" /></el-form-item>
              <el-form-item label="主题色"><el-input v-model="newTemplateColor" placeholder="#4A9EFF" /></el-form-item>
              <el-form-item label="字体"><el-input v-model="newTemplateFont" placeholder="Microsoft YaHei" /></el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="showAddTemplate = false">取消</el-button>
              <el-button type="primary" @click="saveTemplate">保存</el-button>
            </template>
          </el-dialog>
        </div>

        <!-- PPT 输出目录 -->
        <div v-else-if="activeNav === 'pptdir'" class="settings-section">
          <h3>PPT 课件输出目录</h3>
          <el-form-item label="输出目录：">
            <div class="download-dir-row">
              <el-input v-model="pptDir" placeholder="选择PPT课件的保存路径" @blur="savePPTDir" />
              <el-button @click="selectPPTDir" :icon="FolderOpened" />
            </div>
            <div class="setting-tip">AI 生成的课件（.pptx 文件）将保存到此目录。留空则使用下载目录。</div>
          </el-form-item>
        </div>

        <!-- 关于 -->
        <div v-else-if="activeNav === 'privacy'" class="settings-section">
          <h3>隐私与加密</h3>
          <el-form-item label="端到端加密：">
            <el-radio-group v-model="e2eEncryption" @change="handleE2EChange">
              <el-radio-button value="off">
                <el-icon><Lock /></el-icon>
                关闭
              </el-radio-button>
              <el-radio-button value="lan">
                <el-icon><Lock /></el-icon>
                仅内网对话
              </el-radio-button>
              <el-radio-button value="all">
                <el-icon><Lock /></el-icon>
                所有对话
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <p class="setting-tip">端到端加密后，消息内容仅收发双方可以解读，服务端无法查看明文。开启加密后新建的对话生效，已有对话不会自动加密。</p>
          <el-form-item label="加密强度：">
            <el-tag type="success">AES-256-GCM</el-tag>
          </el-form-item>
        </div>

        <div v-else-if="activeNav === 'about'" class="settings-section">
          <h3>{{ t('settings.about') }}</h3>
          <div class="about-info-list">
            <div class="about-row">
              <span class="about-label">{{ t('app.projectName') }}</span>
              <span class="about-value">Electronic</span>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.version') }}</span>
              <span class="about-value">v{{ appVersion }}</span>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.author') }}</span>
              <span class="about-value">FireOut</span>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.github') }}</span>
              <el-link type="primary" :underline="false" @click="handleOpenLink('https://github.com/12yierye/Electronic-Client')">Electronic-Client</el-link>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.website') }}</span>
              <el-link type="primary" :underline="false" @click="handleOpenLink('https://electronic-app.com')">Electronic.com</el-link>
            </div>
            <div class="about-row">
              <span class="about-label">{{ t('app.reportIssue') }}</span>
              <el-link type="primary" :underline="false" @click="handleReportIssue">GitHub Issues</el-link>
            </div>
          </div>
        </div>

        <!-- 检查更新 -->
        <div v-else-if="activeNav === 'checkUpdate'" class="settings-section">
          <h3>{{ t('settings.checkUpdate') }}</h3>
          <div class="update-section">
            <div class="about-row">
              <span class="about-label">{{ t('settings.currentVersion') }}</span>
              <span class="about-value">v{{ appVersion }}</span>
            </div>
            <div class="update-actions">
              <el-button type="primary" @click="handleCheckUpdate" :loading="checkingUpdate">
                {{ checkingUpdate ? t('settings.checking') : t('settings.checkUpdateBtn') }}
              </el-button>
            </div>
            <div v-if="updateMessage" class="update-message" :class="updateMessageType">{{ updateMessage }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Moon, Sunny, Monitor, FolderOpened, Files, User, Setting, MagicStick, Link, Search, Folder, InfoFilled, Message, RefreshRight, Lock, View, Hide } from '@element-plus/icons-vue'
import { useSettingsStore } from '../../stores/settings'
import { useAIStore } from '../../stores/ai'
import { useI18n } from '../../composables/useI18n'
import { languages } from '../../utils/i18n'
import UserProfile from './settings/UserProfile.vue'
import pkg from '../../../package.json'

const settingsStore = useSettingsStore()
const aiStore = useAIStore()
const { t, setLocale } = useI18n()

const appVersion = pkg.version

const activeNav = ref('profile')

const navItems = [
    { key: 'profile', label: '用户资料', icon: User },
    { key: 'appearance', label: '外观', icon: Setting },
    { key: 'chat', label: '聊天设置', icon: Message },
    { key: 'ai', label: 'AI 模型', icon: MagicStick },
    { key: 'server', label: '服务端', icon: Link },
    { key: 'friendSearch', label: '好友搜索', icon: Search },
    { key: 'privacy', label: '隐私加密', icon: Lock },
    { key: 'pptdir', label: 'PPT 输出', icon: Folder },
    { key: 'templates', label: '课件模板', icon: Files },
    { key: 'download', label: '下载目录', icon: Folder },
    { key: 'checkUpdate', label: '检查更新', icon: RefreshRight },
    { key: 'about', label: '关于', icon: InfoFilled }
]

const theme = ref('dark')
const language = ref('zh-CN')
const serverIP = ref('127.0.0.1')
const serverPort = ref('3000')
const testingServer = ref(false)
const enablePinyinSearch = ref(false)
const useSystemBrowser = ref(false)
const sendKey = ref('Enter')
const e2eEncryption = ref('off')
const friendListDensity = ref('compact')
const navFlashIntensity = ref('medium')
const cacheRetentionDays = ref(30)
const cacheDayOptions = [7, 14, 30, 60, 90, 180]
const showModeUnreadBadge = ref(true)
const showTabUnreadBadge = ref(true)
const checkingUpdate = ref(false)
const updateMessage = ref('')
const updateMessageType = ref('')

const AI_SETTINGS_KEY = 'aiApiSettings'

const aiServerIP = ref('127.0.0.1')
const aiServerPort = ref('1234')

const aiSettingsMode = ref('local')

const cloudProviderId = ref('')
const cloudApiBase = ref('https://api.openai.com/v1')
const cloudApiKey = ref('')
const cloudModel = ref('gpt-4o')
const keyVisible = ref(false)
const testingCloud = ref(false)
const pptDir = ref('')
const contextTokens = ref(32000)
const activeTemplate = ref('blue')
const templateList = ref([])
const showAddTemplate = ref(false)
const newTemplateName = ref('')
const newTemplateColor = ref('')
const newTemplateFont = ref('Microsoft YaHei')

const maxContextLimit = computed(() => {
  const p = PROVIDERS.find(p => p.id === cloudProviderId.value)
  if (p && p.models.length > 0) {
    const m = cloudModel.value ? p.models.find(m => m.id === cloudModel.value) : p.models[0]
    if (m?.contextLimit) return m.contextLimit
  }
  return 100000
})

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', thinking: 'none', contextLimit: 1000000 }, { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', thinking: 'always', contextLimit: 1000000 }] },
  { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', models: [{ id: 'gpt-4o', name: 'GPT-4o', thinking: 'none' }, { id: 'gpt-4o-mini', name: 'GPT-4o Mini', thinking: 'none' }, { id: 'o3-mini', name: 'o3-mini', thinking: 'optional' }, { id: 'o1', name: 'o1', thinking: 'always' }] },
  { id: 'qwen', name: '通义千问', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: [{ id: 'qwen-plus', name: 'Qwen Plus', thinking: 'none' }, { id: 'qwen-max', name: 'Qwen Max', thinking: 'optional' }, { id: 'qwen-turbo', name: 'Qwen Turbo', thinking: 'none' }, { id: 'qwen-long', name: 'Qwen Long', thinking: 'none' }] },
  { id: 'zhipu', name: '智谱AI', baseURL: 'https://open.bigmodel.cn/api/paas/v4', models: [{ id: 'glm-4-flash', name: 'GLM-4 Flash', thinking: 'none' }, { id: 'glm-4', name: 'GLM-4', thinking: 'optional' }, { id: 'glm-4-plus', name: 'GLM-4 Plus', thinking: 'optional' }] },
  { id: 'moonshot', name: 'Moonshot', baseURL: 'https://api.moonshot.cn/v1', models: [{ id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', thinking: 'none' }, { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', thinking: 'none' }, { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', thinking: 'none' }] },
  { id: 'custom', name: '自定义', baseURL: '', models: [] }
]

const providerList = PROVIDERS

const currentProviderModels = computed(() => {
  const p = PROVIDERS.find(p => p.id === cloudProviderId.value)
  return p ? p.models : []
})

const CLOUD_API_KEY = 'cloudApiSettings'

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

const saveCloudApiSettings = () => {
    const data = { base: cloudApiBase.value, model: cloudModel.value, provider: cloudProviderId.value, key: cloudApiKey.value }
    localStorage.setItem(CLOUD_API_KEY, JSON.stringify(data))
    if (window.electronAPI?.setCloudApiBase) {
        window.electronAPI.setCloudApiBase(cloudApiBase.value)
    }
    if (window.electronAPI?.setCloudApiKey) {
        window.electronAPI.setCloudApiKey(cloudApiKey.value)
    }
    if (window.electronAPI?.setCloudModel) {
        window.electronAPI.setCloudModel(cloudModel.value)
    }
    if (window.electronAPI?.setCloudProvider) {
        window.electronAPI.setCloudProvider(cloudProviderId.value)
    }
}

const handleProviderChange = (providerId) => {
    const p = PROVIDERS.find(p => p.id === providerId)
    if (p) {
        if (p.baseURL) {
            cloudApiBase.value = p.baseURL
        }
        if (p.models.length > 0) {
            cloudModel.value = p.models[0].id
        }
        cloudProviderId.value = providerId
    }
}

const saveAiMode = () => {
    localStorage.setItem('aiMode', aiSettingsMode.value)
}

const testCloudApi = async () => {
    if (!cloudApiKey.value) return
    testingCloud.value = true
    try {
        const result = window.electronAPI.testCloudApi
            ? await window.electronAPI.testCloudApi({ base: cloudApiBase.value, key: cloudApiKey.value, model: cloudModel.value })
            : { success: false, message: '功能不可用' }
        if (result.success) {
            ElMessage.success(result.message)
        } else {
            ElMessage.error(result.message)
        }
    } catch (e) {
        ElMessage.error('测试失败：' + e.message)
    }
    testingCloud.value = false
}

const savePPTDir = () => {
    const dir = pptDir.value.trim()
    localStorage.setItem('pptDir', dir)
    if (window.electronAPI?.setPPTDir) {
        window.electronAPI.setPPTDir(dir || null)
    }
}

const selectPPTDir = async () => {
    if (!window.electronAPI?.selectDirectory) return
    const result = await window.electronAPI.selectDirectory()
    if (result.success && result.dir) {
        pptDir.value = result.dir
        savePPTDir()
    }
}

const saveContextTokens = () => {
    if (contextTokens.value > maxContextLimit.value) {
        contextTokens.value = maxContextLimit.value
    }
    localStorage.setItem('aiContextTokens', contextTokens.value)
    if (aiStore) aiStore.setContextTokens(contextTokens.value)
}

const loadTemplates = () => {
    try {
        templateList.value = JSON.parse(localStorage.getItem('ai_templates') || '[]')
        if (templateList.value.length === 0) {
            templateList.value = [
                { id: 'blue', name: '蓝色学术', color: '#4A9EFF', font: 'Microsoft YaHei' },
                { id: 'academic', name: '简约学术', color: '#2980B9', font: 'SimSun' },
                { id: 'warm', name: '暖色教学', color: '#E67E22', font: 'Microsoft YaHei' }
            ]
            localStorage.setItem('ai_templates', JSON.stringify(templateList.value))
        }
        activeTemplate.value = localStorage.getItem('ai_active_template') || 'blue'
    } catch {}
}

const applyTemplate = (id) => {
    localStorage.setItem('ai_active_template', id)
}

const saveTemplate = () => {
    if (!newTemplateName.value.trim()) return
    templateList.value.push({
        id: 'tpl_' + Date.now(),
        name: newTemplateName.value.trim(),
        color: newTemplateColor.value || '#4A9EFF',
        font: newTemplateFont.value || 'Microsoft YaHei'
    })
    localStorage.setItem('ai_templates', JSON.stringify(templateList.value))
    showAddTemplate.value = false
    newTemplateName.value = ''
    newTemplateColor.value = ''
    newTemplateFont.value = 'Microsoft YaHei'
}

onMounted(() => {
    theme.value = settingsStore.theme
    language.value = settingsStore.language || 'zh-CN'
    useSystemBrowser.value = settingsStore.useSystemBrowser
    sendKey.value = settingsStore.sendKey || 'Enter'
    friendListDensity.value = settingsStore.friendListDensity || 'compact'
    navFlashIntensity.value = settingsStore.navFlashIntensity || 'medium'
    cacheRetentionDays.value = settingsStore.cacheRetentionDays || 30
    showModeUnreadBadge.value = settingsStore.showModeUnreadBadge !== undefined ? settingsStore.showModeUnreadBadge : true
    showTabUnreadBadge.value = settingsStore.showTabUnreadBadge !== undefined ? settingsStore.showTabUnreadBadge : true

    const aiSettings = localStorage.getItem(AI_SETTINGS_KEY)
    if (aiSettings) {
        const s = JSON.parse(aiSettings)
        aiServerIP.value = s.ip || '127.0.0.1'
        aiServerPort.value = s.port || '1234'
    }
    saveAiApiSettings()

    const cloudRaw = localStorage.getItem(CLOUD_API_KEY)
    if (cloudRaw) {
        const s = JSON.parse(cloudRaw)
        cloudApiBase.value = s.base || 'https://api.openai.com/v1'
        cloudModel.value = s.model || 'gpt-4o'
        cloudProviderId.value = s.provider || ''
        cloudApiKey.value = s.key || ''
    }
    saveCloudApiSettings()

    const savedMode = localStorage.getItem('aiMode')
    if (savedMode) aiSettingsMode.value = savedMode

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
    } else     if (window.electronAPI?.getDownloadDir) {
        window.electronAPI.getDownloadDir().then((result) => {
            if (result.success) {
                downloadDir.value = result.dir
            }
        })
    }

    const e2e = localStorage.getItem('e2eEncryption')
    if (e2e) e2eEncryption.value = e2e

    const savedPPTDir = localStorage.getItem('pptDir')
    if (savedPPTDir) pptDir.value = savedPPTDir
    if (window.electronAPI?.setPPTDir) {
        window.electronAPI.setPPTDir(savedPPTDir || null)
    }

    const savedCtx = localStorage.getItem('aiContextTokens')
    if (savedCtx) contextTokens.value = parseInt(savedCtx) || 32000

    const navPreference = localStorage.getItem('settingsActiveNav')
    if (navPreference) {
        activeNav.value = navPreference
        localStorage.removeItem('settingsActiveNav')
    }

    loadTemplates()
})

const handleThemeChange = (value) => {
    settingsStore.toggleTheme(value)
}

const handleLanguageChange = (value) => {
    setLocale(value)
}

const handleUseSystemBrowserChange = (value) => {
    settingsStore.toggleUseSystemBrowser(value)
}

const handleSendKeyChange = (value) => {
    settingsStore.setSendKey(value)
}

const handleE2EChange = (value) => {
  localStorage.setItem('e2eEncryption', value)
}

const handleFriendListDensityChange = (value) => {
    settingsStore.setFriendListDensity(value)
}

const handleNavFlashIntensityChange = (value) => {
    settingsStore.setNavFlashIntensity(value)
}

const handleCacheRetentionDaysChange = (value) => {
    settingsStore.setCacheRetentionDays(value)
}

const handleShowModeUnreadBadgeChange = (value) => {
    settingsStore.setShowModeUnreadBadge(value)
}

const handleShowTabUnreadBadgeChange = (value) => {
    settingsStore.setShowTabUnreadBadge(value)
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

const handleOpenLink = async (url) => {
    if (useSystemBrowser.value && window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url)
    } else {
        window.open(url, '_blank')
    }
}

const handleReportIssue = () => {
    handleOpenLink('https://github.com/12yierye/Electronic-Client/issues')
}

const handleCheckUpdate = async () => {
    checkingUpdate.value = true
    updateMessage.value = ''
    updateMessageType.value = ''

    try {
        const res = await fetch('https://api.github.com/repos/12yierye/Electronic-Client/releases/latest')

        if (res.status === 404) {
            updateMessage.value = t('settings.noReleases')
            updateMessageType.value = 'error'
            return
        }

        if (res.status === 403 || res.status === 429) {
            updateMessage.value = t('settings.updateFailed')
            updateMessageType.value = 'error'
            return
        }

        if (!res.ok) throw new Error('GitHub API error')

        const data = await res.json()

        if (!data || !data.tag_name) {
            updateMessage.value = t('settings.updateFailed')
            updateMessageType.value = 'error'
            return
        }

        const latestVersion = data.tag_name.replace(/^v/, '')
        const current = appVersion

        const compareVersions = (a, b) => {
            const pa = a.split('.').map(Number)
            const pb = b.split('.').map(Number)
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                const va = pa[i] || 0
                const vb = pb[i] || 0
                if (va > vb) return 1
                if (va < vb) return -1
            }
            return 0
        }

        const cmp = compareVersions(latestVersion, current)

        if (cmp <= 0) {
            updateMessage.value = t('settings.alreadyLatest') + ' (v' + current + ')'
            updateMessageType.value = 'success'
        } else {
            updateMessage.value = t('settings.updateFound') + ': v' + latestVersion
            updateMessageType.value = 'info'
        }
    } catch {
        updateMessage.value = t('settings.updateFailed')
        updateMessageType.value = 'error'
    } finally {
        checkingUpdate.value = false
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
                    margin: 0 0 20px;
                    color: var(--text-primary);
                    font-size: 18px;
                    font-weight: 600;
                }

                .el-form-item {
                    margin-bottom: 18px;
                    display: block !important;

                    :deep(.el-form-item__label) {
                        display: block;
                        color: var(--text-primary);
                        font-weight: 500;
                        margin-bottom: 6px;
                        padding: 0;
                        line-height: 1.4;
                        float: none;
                        width: auto;
                    }

                    :deep(.el-form-item__content) {
                        display: block !important;
                        width: 100%;
                        margin-left: 0 !important;
                    }
                }

                .badge-settings-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;

                    .badge-setting-row {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }

                    .switch-with-label {
                        display: flex;
                        align-items: center;
                        gap: 10px;

                        .badge-label {
                            font-size: 14px;
                            color: var(--text-primary);
                            font-weight: 500;
                        }
                    }

                    .setting-tip-inline {
                        font-size: 12px;
                        color: var(--text-secondary);
                        padding-left: 44px;
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
                    margin-top: 6px;
                    display: block;
                    line-height: 1.5;
                }

                .key-input-row {
                    display: flex;
                    gap: 6px;
                    align-items: center;
                }

                .download-dir-row {
                    display: flex;
                    gap: 8px;

                    .el-input {
                        flex: 1;
                    }
                }

                .about-info-list {
                    .about-row {
                        display: flex;
                        align-items: center;
                        padding: 10px 0;
                        border-bottom: 1px solid var(--border-color);

                        &:last-child {
                            border-bottom: none;
                        }

                        .about-label {
                            width: 100px;
                            flex-shrink: 0;
                            font-size: 14px;
                            color: var(--text-secondary);
                        }

                        .about-value {
                            font-size: 14px;
                            color: var(--text-primary);
                            font-weight: 500;
                        }

                        .el-link {
                            font-size: 14px;
                        }
                    }
                }

                .update-section {
                    .about-row {
                        display: flex;
                        align-items: center;
                        padding: 10px 0;
                        border-bottom: 1px solid var(--border-color);

                        .about-label {
                            width: 100px;
                            flex-shrink: 0;
                            font-size: 14px;
                            color: var(--text-secondary);
                        }

                        .about-value {
                            font-size: 14px;
                            color: var(--text-primary);
                            font-weight: 500;
                        }
                    }

                    .update-actions {
                        margin-top: 20px;
                    }

                    .update-message {
                        margin-top: 16px;
                        padding: 10px 16px;
                        border-radius: 8px;
                        font-size: 14px;

                        &.success {
                            background: rgba(103, 194, 58, 0.1);
                            color: #67c23a;
                            border: 1px solid rgba(103, 194, 58, 0.2);
                        }

                        &.info {
                            background: rgba(64, 158, 255, 0.1);
                            color: #409eff;
                            border: 1px solid rgba(64, 158, 255, 0.2);
                        }

                        &.error {
                            background: rgba(245, 108, 108, 0.1);
                            color: #f56c6c;
                            border: 1px solid rgba(245, 108, 108, 0.2);
                        }
                    }
                }

                .switch-with-tip {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
            }
        }
    }
}
</style>
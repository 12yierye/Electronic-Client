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

      <!-- 内网服务器设置 -->
      <el-divider />
      <h3>内网聊天设置</h3>
      
      <el-form-item label="使用内网聊天：">
        <el-switch v-model="useLanChat" @change="handleLanChatChange" />
      </el-form-item>
      
      <el-form-item v-if="useLanChat" label="内网服务器IP：">
        <el-input
          v-model="lanServerIP"
          placeholder="例如: 192.168.1.100"
          @blur="saveLanServerIP"
        />
        <div class="setting-tip">请输入运行内网服务端的计算机IP地址</div>
      </el-form-item>
      
      <el-form-item v-if="useLanChat" label="内网服务器端口：">
        <el-input
          v-model="lanServerPort"
          placeholder="例如: 3001"
          @blur="saveLanServerPort"
        />
      </el-form-item>
      
      <el-form-item v-if="useLanChat">
        <el-button type="primary" @click="testLanConnection" :loading="testingLan">
          测试连接
        </el-button>
      </el-form-item>

      <!-- 好友搜索设置 -->
      <el-divider />
      <h3>好友搜索设置</h3>
      
      <el-form-item label="启用拼音搜索：">
        <el-switch v-model="enablePinyinSearch" @change="savePinyinSearchSetting" />
        <div class="setting-tip">开启后可以使用拼音搜索好友（例如输入"zhangsan"可搜索到"张三"）</div>
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
import { Moon, Sunny } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../../stores/settings'
import { useI18n } from '../../composables/useI18n'
import { languages } from '../../utils/i18n'

const settingsStore = useSettingsStore()
const { t, setLocale } = useI18n()

const theme = ref('dark')
const language = ref('zh-CN')
const useLanChat = ref(false)
const lanServerIP = ref('')
const lanServerPort = ref('3000')
const testingLan = ref(false)
const enablePinyinSearch = ref(false)

const LAN_SETTINGS_KEY = 'lanChatSettings'

// 初始化
onMounted(() => {
  theme.value = settingsStore.theme
  language.value = settingsStore.language || 'zh-CN'
  
  // 加载内网设置
  const lanSettings = localStorage.getItem(LAN_SETTINGS_KEY)
  if (lanSettings) {
    const settings = JSON.parse(lanSettings)
    useLanChat.value = settings.useLanChat || false
    lanServerIP.value = settings.lanServerIP || ''
    lanServerPort.value = settings.lanServerPort || '3001'
    enablePinyinSearch.value = settings.enablePinyinSearch || false
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

// 保存内网设置
const saveLanSettings = () => {
  const settings = {
    useLanChat: useLanChat.value,
    lanServerIP: lanServerIP.value,
    lanServerPort: lanServerPort.value,
    enablePinyinSearch: enablePinyinSearch.value
  }
  localStorage.setItem(LAN_SETTINGS_KEY, JSON.stringify(settings))
}

// 保存拼音搜索设置
const savePinyinSearchSetting = () => {
  saveLanSettings()
}

// 内网聊天开关变化
const handleLanChatChange = (value) => {
  saveLanSettings()
}

// 保存内网服务器IP
const saveLanServerIP = () => {
  saveLanSettings()
}

// 保存内网服务器端口
const saveLanServerPort = () => {
  saveLanSettings()
}

// 测试内网连接
const testLanConnection = async () => {
  if (!lanServerIP.value) {
    ElMessage.warning('请输入内网服务器IP')
    return
  }
  
  testingLan.value = true
  try {
    const response = await fetch(`http://${lanServerIP.value}:${lanServerPort.value}/health`, {
      method: 'GET',
      timeout: 5000
    })
    if (response.ok) {
      ElMessage.success('连接成功！内网聊天服务正常运行')
    } else {
      ElMessage.error('连接失败：服务器返回错误')
    }
  } catch (error) {
    ElMessage.error('连接失败：' + error.message)
  } finally {
    testingLan.value = false
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
      margin-top: 8px;
      font-size: 12px;
      color: var(--text-secondary);
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

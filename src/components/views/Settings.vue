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
import { useSettingsStore } from '../../stores/settings'
import { useI18n } from '../../composables/useI18n'
import { languages } from '../../utils/i18n'

const settingsStore = useSettingsStore()
const { t, setLocale } = useI18n()

const theme = ref('dark')
const language = ref('zh-CN')

// 初始化
onMounted(() => {
  theme.value = settingsStore.theme
  language.value = settingsStore.language || 'zh-CN'
})

// 主题切换
const handleThemeChange = (value) => {
  settingsStore.toggleTheme(value)
}

// 语言切换
const handleLanguageChange = (value) => {
  setLocale(value)
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

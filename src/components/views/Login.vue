<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('login.title') }}</span>
        </div>
      </template>
      <el-form :model="loginForm" :rules="rules" ref="formRef" label-width="0">
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            :placeholder="t('login.username')"
            :prefix-icon="User"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            :placeholder="t('login.password')"
            :prefix-icon="Lock"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="autoLogin" :disabled="autoLoginSuccess">{{ t('login.autoLogin') }}</el-checkbox>
          <span v-if="autoLoginSuccess" class="auto-login-tip">{{ t('login.autoLoginEnabled') }}</span>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            style="width: 100%"
            :loading="loading"
            :disabled="autoLoginSuccess"
            @click="handleLogin"
          >
            {{ autoLoginSuccess ? t('login.loggingIn') : t('login.login') }}
          </el-button>
        </el-form-item>
      </el-form>
      <div class="footer-links">
        <span class="register-link" @click="handleRegister">{{ t('login.register') }}</span>
        <span class="server-address" @click="openServerDialog">
          <el-icon class="server-edit-icon"><EditPen /></el-icon>
          {{ t('login.defaultServer') }} {{ apiBase }}
        </span>
      </div>
    </el-card>

    <!-- 注册对话框 -->
    <el-dialog v-model="registerDialogVisible" :title="t('login.registerTitle')" width="400px">
      <el-form :model="registerForm" :rules="registerRules" ref="registerFormRef" label-width="80px">
        <el-form-item :label="t('login.username')" prop="username">
          <el-input v-model="registerForm.username" :placeholder="t('login.usernamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('login.password')" prop="password">
          <el-input v-model="registerForm.password" type="password" :placeholder="t('login.passwordPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('login.email')" prop="email">
          <el-input v-model="registerForm.email" :placeholder="t('login.emailPlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="registerDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="registerLoading" @click="handleRegisterSubmit">{{ t('login.register') }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑服务器地址对话框 -->
    <el-dialog v-model="serverDialogVisible" :title="t('login.editServer')" width="400px" class="server-dialog">
      <el-form label-width="80px">
        <el-form-item :label="t('login.serverIP')">
          <el-input v-model="serverIP" :placeholder="t('settings.serverIPPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('login.serverPort')">
          <el-input v-model="serverPort" :placeholder="t('settings.serverPortPlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="serverDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="savingServer" @click="saveServerSettings">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { User, Lock, EditPen } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from '../../composables/useI18n'

const emit = defineEmits(['login-success', 'auto-login-success'])
const { t } = useI18n()

const SERVER_SETTINGS_KEY = 'lanChatSettings'

const formRef = ref(null)
const loading = ref(false)
const testingConnection = ref(false)
const autoLogin = ref(false)
const autoLoginChecked = ref(false)
const autoLoginSuccess = ref(false)
const apiBase = ref('http://localhost:3000')

// 服务器地址编辑
const serverDialogVisible = ref(false)
const serverIP = ref('127.0.0.1')
const serverPort = ref('3000')
const savingServer = ref(false)

// 读取保存的服务器设置
const loadServerSettings = () => {
    const raw = localStorage.getItem(SERVER_SETTINGS_KEY)
    if (raw) {
        try {
            const s = JSON.parse(raw)
            const ip = s.serverIP || '127.0.0.1'
            const port = s.serverPort || '3000'
            serverIP.value = ip
            serverPort.value = port
            apiBase.value = `http://${ip}:${port}`
        } catch (e) {
            // ignore
        }
    }
}

const openServerDialog = () => {
    loadServerSettings()
    serverDialogVisible.value = true
}

const saveServerSettings = async () => {
    if (!serverIP.value) {
        ElMessage.warning(t('settings.enterServerIP'))
        return
    }
    savingServer.value = true
    try {
        const ip = serverIP.value.trim()
        const port = serverPort.value.trim() || '3000'
        const url = `http://${ip}:${port}`

        const settings = { serverIP: ip, serverPort: port }
        localStorage.setItem(SERVER_SETTINGS_KEY, JSON.stringify(settings))
        apiBase.value = url

        if (window.electronAPI?.setApiBaseUrl) {
            await window.electronAPI.setApiBaseUrl(url)
        }

        ElMessage.success(t('login.serverSaved'))
        serverDialogVisible.value = false
    } catch (error) {
        ElMessage.error(error.message)
    } finally {
        savingServer.value = false
    }
}

// 注册相关
const registerDialogVisible = ref(false)
const registerLoading = ref(false)
const registerFormRef = ref(null)
const registerForm = reactive({
  username: '',
  password: '',
  email: ''
})
const registerRules = computed(() => ({
  username: [{ required: true, message: t('login.usernameRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }],
  email: [
    { required: true, message: t('login.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('login.emailInvalid'), trigger: 'blur' }
  ]
}))

const loginForm = reactive({
  username: '',
  password: ''
})

const rules = computed(() => ({
  username: [{ required: true, message: t('login.usernameRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }]
}))

// 处理注册点击
const handleRegister = () => {
  registerForm.username = ''
  registerForm.password = ''
  registerForm.email = ''
  registerDialogVisible.value = true
}

// 提交注册
const handleRegisterSubmit = async () => {
  if (!registerFormRef.value) return

  await registerFormRef.value.validate(async (valid) => {
    if (!valid) return

    registerLoading.value = true
    try {
      const result = await window.electronAPI.register({
        username: registerForm.username,
        password: registerForm.password,
        email: registerForm.email
      })

      if (result.success) {
        ElMessage.success(t('login.registerSuccess'))
        registerDialogVisible.value = false
      } else {
        ElMessage.error(result.message || t('login.registerFailed'))
      }
    } catch (error) {
      ElMessage.error(t('login.registerFailed') + ': ' + error.message)
    } finally {
      registerLoading.value = false
    }
  })
}

// 组件挂载时自动检查自动登录
onMounted(async () => {
    loadServerSettings()
    const credentialStr = localStorage.getItem('autoLoginCredential')
    if (credentialStr) {
        autoLoginChecked.value = true
        autoLogin.value = true

        const success = await checkAutoLogin()
        if (success) {
            autoLoginSuccess.value = true
        }
    }
})

// 生成凭证
const generateCredential = (user) => {
  const credential = {
    username: user.username,
    token: btoa(`${user.username}:${Date.now()}:${Math.random().toString(36).substr(2)}`),
    createdAt: Date.now()
  }
  localStorage.setItem('autoLoginCredential', JSON.stringify(credential))
  return credential
}

// 验证凭证
const verifyCredential = async (credential) => {
  if (!credential || !credential.username || !credential.token) {
    return false
  }

  try {
    const result = await window.electronAPI.verifyCredential(credential.username, credential.token)
    return result.success
  } catch (error) {
    console.error('[Login] credential check failed:', error)
    return false
  }
}

// 检查自动登录
const checkAutoLogin = async () => {
  const credentialStr = localStorage.getItem('autoLoginCredential')
  if (!credentialStr) return false

  try {
    const credential = JSON.parse(credentialStr)

    // 检查凭证是否过期（30天）
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - credential.createdAt > thirtyDays) {
      localStorage.removeItem('autoLoginCredential')
      return false
    }

    // 验证凭证
    const isValid = await verifyCredential(credential)
    if (isValid) {
      // 自动登录成功
      const userResult = await window.electronAPI.getUserByUsername(credential.username)
      if (userResult.success) {
        localStorage.setItem('userInfo', JSON.stringify(userResult.user))
        ElMessage.success(t('login.autoLoginSuccess'))
        emit('auto-login-success', userResult.user)
        return true
      }
    }

    // 凭证无效，删除
    localStorage.removeItem('autoLoginCredential')
    return false
  } catch (error) {
    console.error('[Login] auto-login check failed:', error)
    localStorage.removeItem('autoLoginCredential')
    return false
  }
}

const handleLogin = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      // 服务器登录（admin 用户需在服务器上创建）
      const result = await window.electronAPI.login(loginForm.username, loginForm.password)
      if (result.success) {
        localStorage.setItem('userInfo', JSON.stringify(result.user))

        // 如果勾选了自动登录，生成凭证
        if (autoLogin.value) {
          try {
            // 尝试在服务端创建凭证
            const credResult = await window.electronAPI.createCredential(loginForm.username)
            if (credResult.success && credResult.token) {
              const credential = {
                username: loginForm.username,
                token: credResult.token,
                createdAt: Date.now()
              }
              localStorage.setItem('autoLoginCredential', JSON.stringify(credential))
            } else {
              // 如果服务端不支持，使用本地凭证
              generateCredential(result.user)
            }
          } catch (e) {
            // 使用本地凭证
            generateCredential(result.user)
          }
        } else {
          // 清除之前的凭证
          localStorage.removeItem('autoLoginCredential')
        }

        ElMessage.success(t('login.loginSuccess'))
        emit('login-success', result.user)
      } else {
        ElMessage.error(result.message || t('login.loginFailed'))
      }
    } catch (error) {
      ElMessage.error(t('login.loginFailed') + ': ' + error.message)
    } finally {
      loading.value = false
    }
  })
}

// 暴露检查自动登录方法
defineExpose({ checkAutoLogin })
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
}

.login-card {
  width: 400px;
  
  .card-header {
    text-align: center;
    font-size: 20px;
    font-weight: bold;
  }
  
  .footer-links {
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
    display: flex;
    justify-content: space-between;
  }

  .register-link {
    color: var(--accent-color);
    cursor: pointer;
    &:hover {
      text-decoration: underline;
    }
  }

  .server-address {
    color: var(--text-secondary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: color 0.2s;
    &:hover {
      color: var(--accent-color);
      .server-edit-icon {
        opacity: 1;
      }
    }
  }

  .server-edit-icon {
    font-size: 12px;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  :deep(.el-checkbox) {
    margin-left: 0;
    width: 100%;
    text-align: left;
  }

  .auto-login-tip {
    margin-left: 10px;
    font-size: 12px;
    color: var(--el-color-success);
  }
}
</style>

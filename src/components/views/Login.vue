<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('login.title') }}</span>
        </div>
      </template>
      <el-form :model="loginForm" :rules="rules.value" ref="formRef" label-width="0">
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
        <span class="register-link" @click="handleRegister">{{ t('login.register') || '注册' }}</span>
        <span>{{ t('login.defaultServer') }} {{ apiBase }}</span>
      </div>
    </el-card>

    <!-- 注册对话框 -->
    <el-dialog v-model="registerDialogVisible" title="注册账号" width="400px">
      <el-form :model="registerForm" :rules="registerRules" ref="registerFormRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="registerForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="registerForm.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="registerForm.email" placeholder="请输入邮箱" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="registerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="registerLoading" @click="handleRegisterSubmit">注册</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from '../../composables/useI18n'

const emit = defineEmits(['login-success', 'auto-login-success'])
const { t } = useI18n()

const formRef = ref(null)
const loading = ref(false)
const autoLogin = ref(false)
const autoLoginChecked = ref(false) // 是否已检查过自动登录
const autoLoginSuccess = ref(false) // 自动登录是否成功
const apiBase = 'http://192.168.61.129:3000'

// 注册相关
const registerDialogVisible = ref(false)
const registerLoading = ref(false)
const registerFormRef = ref(null)
const registerForm = reactive({
  username: '',
  password: '',
  email: ''
})
const registerRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ]
}

const loginForm = reactive({
  username: '',
  password: ''
})

const rules = ref({
  username: [{ required: true, message: t('login.usernameRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }]
})

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
        ElMessage.success('注册成功，请登录')
        registerDialogVisible.value = false
      } else {
        ElMessage.error(result.message || '注册失败')
      }
    } catch (error) {
      ElMessage.error('注册失败: ' + error.message)
    } finally {
      registerLoading.value = false
    }
  })
}

// 组件挂载时自动检查自动登录
onMounted(async () => {
  const credentialStr = localStorage.getItem('autoLoginCredential')
  if (credentialStr) {
    autoLoginChecked.value = true
    autoLogin.value = true // 勾选自动登录

    // 尝试自动登录
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
    console.error('验证凭证失败:', error)
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
        ElMessage.success('自动登录成功')
        emit('auto-login-success', userResult.user)
        return true
      }
    }

    // 凭证无效，删除
    localStorage.removeItem('autoLoginCredential')
    return false
  } catch (error) {
    console.error('自动登录检查失败:', error)
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

        ElMessage.success('登录成功')
        emit('login-success', result.user)
      } else {
        ElMessage.error(result.message || '登录失败')
      }
    } catch (error) {
      ElMessage.error('登录失败: ' + error.message)
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
    color: #999;
    font-size: 12px;
    display: flex;
    justify-content: space-between;
  }

  .register-link {
    color: #409eff;
    cursor: pointer;
    &:hover {
      text-decoration: underline;
    }
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

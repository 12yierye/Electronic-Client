<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span>登录 Electronic</span>
        </div>
      </template>
      <el-form :model="loginForm" :rules="rules" ref="formRef" label-width="0">
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="用户名"
            :prefix-icon="User"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="autoLogin" :disabled="autoLoginSuccess">自动登录</el-checkbox>
          <span v-if="autoLoginSuccess" class="auto-login-tip">自动登录已开启</span>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            style="width: 100%"
            :loading="loading"
            :disabled="autoLoginSuccess"
            @click="handleLogin"
          >
            {{ autoLoginSuccess ? '自动登录中...' : '登录' }}
          </el-button>
        </el-form-item>
      </el-form>
      <div class="tips">
        <span>默认服务器: {{ apiBase }}</span>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits(['login-success', 'auto-login-success'])

const formRef = ref(null)
const loading = ref(false)
const autoLogin = ref(false)
const autoLoginChecked = ref(false) // 是否已检查过自动登录
const autoLoginSuccess = ref(false) // 自动登录是否成功
const apiBase = 'http://192.168.61.129:3000'

const loginForm = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
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
import { defineExpose } from 'vue'
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
  
  .tips {
    text-align: center;
    color: #999;
    font-size: 12px;
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

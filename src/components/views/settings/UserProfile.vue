<template>
  <div class="user-profile-settings">
    <h3>用户资料</h3>

    <el-form label-width="100px">
      <el-form-item label="头像">
        <div class="avatar-section">
          <el-avatar :size="80" class="profile-avatar" v-if="profile.avatar">
            <img :src="profile.avatar" alt="avatar" />
          </el-avatar>
          <el-avatar :size="80" class="profile-avatar" v-else>{{ displayInitial }}</el-avatar>
          <div class="avatar-actions">
            <el-button size="small" @click="triggerAvatarUpload">更换头像</el-button>
            <div class="avatar-tip">支持 PNG / JPG / WEBP / BMP / JPEG，≤5MB</div>
          </div>
          <input
            ref="avatarInputRef"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/bmp"
            style="display: none"
            @change="handleAvatarSelected"
          />
        </div>
      </el-form-item>

      <el-form-item label="用户名">
        <el-input v-model="profile.username" disabled />
      </el-form-item>

      <el-form-item label="个性签名">
        <el-input
          v-model="profile.signature"
          type="textarea"
          :rows="3"
          maxlength="100"
          show-word-limit
          placeholder="未设置"
        />
      </el-form-item>

      <el-form-item label="生日">
        <el-date-picker
          v-model="profile.birthday"
          type="date"
          placeholder="选择日期"
          value-format="YYYY-MM-DD"
          :disabled-date="disabledDate"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="性别">
        <el-radio-group v-model="profile.gender">
          <el-radio-button value="male">男</el-radio-button>
          <el-radio-button value="female">女</el-radio-button>
          <el-radio-button value="private">保密</el-radio-button>
          <el-radio-button value="none">无</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { clearAvatarCache } from '../../../composables/useAvatar'

const avatarInputRef = ref(null)
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp']
const MAX_SIZE = 5 * 1024 * 1024

function getCurrentUsername() {
  try {
    const user = localStorage.getItem('userInfo')
    return user ? JSON.parse(user).username : ''
  } catch {
    return ''
  }
}

function getProfileKey() {
  const username = getCurrentUsername()
  return username ? `profile_${username}` : 'profile'
}

const profile = ref({
  username: '',
  signature: '',
  birthday: '',
  gender: 'none',
  avatar: ''
})

const displayInitial = computed(() => {
  return profile.value.username ? profile.value.username.charAt(0).toUpperCase() : '?'
})

const disabledDate = (time) => {
  const min = new Date(1900, 0, 1).getTime()
  const max = Date.now()
  const t = time.getTime()
  return t < min || t > max
}

const triggerAvatarUpload = () => {
  avatarInputRef.value?.click()
}

const handleAvatarSelected = (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  if (!ALLOWED_TYPES.includes(file.type)) {
    ElMessage.warning('仅支持 PNG / JPG / WEBP / BMP / JPEG 格式')
    e.target.value = ''
    return
  }

  if (file.size > MAX_SIZE) {
    ElMessage.warning('头像文件不能超过 5MB')
    e.target.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = (ev) => {
    profile.value.avatar = ev.target.result
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function getServerBaseUrl() {
  try {
    const raw = localStorage.getItem('lanChatSettings')
    if (raw) {
      const s = JSON.parse(raw)
      const ip = s.serverIP || '127.0.0.1'
      const port = s.serverPort || '3000'
      return `http://${ip}:${port}`
    }
  } catch {}
  return 'http://localhost:3000'
}

const handleSave = async () => {
  const username = getCurrentUsername()
  const baseUrl = getServerBaseUrl()

  try {
    const res = await fetch(`${baseUrl}/user/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        signature: profile.value.signature,
        birthday: profile.value.birthday,
        gender: profile.value.gender
      })
    })

    const data = await res.json()

    if (!data.success) {
      ElMessage.error(data.message || '保存失败')
      return
    }

    // 同步更新 userInfo（保持签名/生日/性别一致）
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo'))
      if (userInfo) {
        userInfo.signature = profile.value.signature
        userInfo.birthday = profile.value.birthday
        userInfo.gender = profile.value.gender
        localStorage.setItem('userInfo', JSON.stringify(userInfo))
      }
    } catch {}

    // 仍写入 localStorage（用于离线头像回退）
    const key = getProfileKey()
    localStorage.setItem(key, JSON.stringify(profile.value))
    clearAvatarCache()
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error('保存失败，无法连接到服务器')
  }
}

onMounted(() => {
  const username = getCurrentUsername()
  profile.value.username = username

  // 优先从 userInfo（服务端数据）加载
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'))
    if (userInfo) {
      profile.value.signature = userInfo.signature || ''
      profile.value.birthday = userInfo.birthday || ''
      profile.value.gender = userInfo.gender || 'none'
    }
  } catch {}

  // 从本地 profile 缓存加载头像
  const key = getProfileKey()
  const saved = localStorage.getItem(key)
  if (saved) {
    try {
      const data = JSON.parse(saved)
      profile.value.avatar = data.avatar || ''
    } catch {
      // ignore
    }
  }
})
</script>

<style lang="scss" scoped>
.user-profile-settings {
    h3 {
        margin: 0 0 24px;
        color: var(--text-primary);
    }

    .avatar-section {
        display: flex;
        align-items: flex-start;
        gap: 16px;

        .profile-avatar {
            font-size: 28px;
            flex-shrink: 0;
        }

        .avatar-actions {
            display: flex;
            flex-direction: column;
            gap: 6px;

            .avatar-tip {
                font-size: 12px;
                color: var(--text-secondary);
                line-height: 1.3;
            }
        }
    }
}
</style>
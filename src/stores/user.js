import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref(null)
  const isLoggedIn = computed(() => !!userInfo.value)
  
  // 初始化用户信息
  const initUser = () => {
    const stored = localStorage.getItem('userInfo')
    if (stored) {
      userInfo.value = JSON.parse(stored)
    }
  }
  
  // 设置用户信息
  const setUser = (info) => {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }
  
  // 清除用户信息
  const clearUser = () => {
    userInfo.value = null
    localStorage.removeItem('userInfo')
  }
  
  return {
    userInfo,
    isLoggedIn,
    initUser,
    setUser,
    clearUser
  }
})

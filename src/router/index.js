import { createRouter, createWebHashHistory } from 'vue-router'
import AIChat from '../components/views/AIChat.vue'
import ChatRoom from '../components/views/ChatRoom.vue'
import FileManager from '../components/views/FileManager.vue'
import Settings from '../components/views/Settings.vue'

const routes = [
  { path: '/', redirect: '/ai' },
  { path: '/ai', name: 'AI', component: AIChat },
  { path: '/chat', name: 'Chat', component: ChatRoom },
  { path: '/files', name: 'Files', component: FileManager },
  { path: '/settings', name: 'Settings', component: Settings }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router

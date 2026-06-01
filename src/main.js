import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  ArrowDown, ArrowRight, Bell, ChatDotRound, Close, Delete, Document, Download,
  EditPen, Files, Folder, FolderOpened, Hide, InfoFilled, Link, Loading, Lock,
  MagicStick, Message, Monitor, Moon, MoreFilled, Picture, Plus, Promotion,
  RefreshRight, Search, Setting, Star, Sunny, SwitchButton, UploadFilled,
  User, View, WarningFilled
} from '@element-plus/icons-vue'
import App from './App.vue'
import './assets/styles/main.scss'
import './utils/mockApi'
import { useI18n } from './composables/useI18n'

const app = createApp(App)
const pinia = createPinia()

const icons = {
  ArrowDown, ArrowRight, Bell, ChatDotRound, Close, Delete, Document, Download,
  EditPen, Files, Folder, FolderOpened, Hide, InfoFilled, Link, Loading, Lock,
  MagicStick, Message, Monitor, Moon, MoreFilled, Picture, Plus, Promotion,
  RefreshRight, Search, Setting, Star, Sunny, SwitchButton, UploadFilled,
  User, View, WarningFilled
}
for (const [key, component] of Object.entries(icons)) {
  app.component(key, component)
}

app.use(pinia)

const { initLanguage } = useI18n()
initLanguage()

app.mount('#app')

import { BrowserWindow, Menu, app, shell } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs'
import { DOC_SERVER, setMainWindow, getUseSystemBrowser } from './config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const isDev = false

Menu.setApplicationMenu(null)

// function createElectronWindow(URL) {
//   const win = new BrowserWindow({
//     title: 'Electron Docs',
//     width: 1000,
//     height: 750,
//     webPreferences: { webSecurity: false, cache: false }
//   })
//   win.maximize()
//   win.loadURL(URL)
// }

export function createWindow() {
  const preloadPath = join(__dirname, 'preload.cjs')
  // console.log('[Main] Preload:', preloadPath, 'exists:', fs.existsSync(preloadPath))

  const mainWindow = new BrowserWindow({
    title: 'Electronic',
    width: 1100,
    height: 600,
    minWidth: 850,
    minHeight: 500,
    // frame: false,
    icon: join(__dirname, '../public/main48.ico'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      cache: false,
      devTools: isDev,
      partition: 'persist:electronic-main'
    }
  })

  setMainWindow(mainWindow)

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page Loaded')
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    console.log('[Main] Page Load Failed:', errorCode, errorDesc)
  })

  // const menu = Menu.buildFromTemplate([
  //   { label: 'File', submenu: [
  //     { label: 'Quit', role: 'quit', click: () => app.quit() }
  //   ]},
  //   { label: 'Help', submenu: [
  //     { label: 'About Electronic', click: () => createElectronWindow(DOC_SERVER) },
  //     { label: 'Electron Docs (zh-cn)', click: () => createElectronWindow('https://www.electronjs.org/zh/docs/latest') }
  //   ]}
  // ])
  // mainWindow.setMenu(menu)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (getUseSystemBrowser()) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.webContents.openDevTools()

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (global.userInfo) {
      mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('userInfo', JSON.stringify(${JSON.stringify(global.userInfo)}))
      `)
    }
  })

  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.executeJavaScript(`
      console.log('[Renderer] electronAPI:', typeof window.electronAPI)
      if (window.electronAPI) {
        console.log('[Renderer] methods:', Object.keys(window.electronAPI).join(', '))
      }
      window.electronAPI && window.electronAPI.testAI ? 'OK' : 'MISSING'
    `).then(result => {
      console.log('[Main] Preload is', result)
    }).catch(e => console.log('[Main] Preload Check Failed:', e.message))
  }, 2000)
}

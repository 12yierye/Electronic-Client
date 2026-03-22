<<<<<<< HEAD
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'
  
  return {
    plugins: [
      vue(),
      ...(isElectron ? [
        electron([
          {
            entry: 'electron/index.js',
            onstart(options) {
              options.startup()
            },
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron']
                }
              }
            }
          },
          {
            entry: 'electron/preload.js',
            onstart(options) {
              options.reload()
            },
            vite: {
              build: {
                outDir: 'dist-electron'
              }
            }
          }
        ]),
        renderer()
      ] : [])
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    }
  }
})
=======
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'
  
  return {
    plugins: [
      vue(),
      ...(isElectron ? [
        electron([
          {
            entry: 'electron/index.js',
            onstart(options) {
              options.startup()
            },
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron']
                }
              }
            }
          },
          {
            entry: 'electron/preload.js',
            onstart(options) {
              options.reload()
            },
            vite: {
              build: {
                outDir: 'dist-electron'
              }
            }
          }
        ]),
        renderer()
      ] : [])
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    }
  }
})
>>>>>>> f3dad1cfcc8f087826bc135228a1a3df7c24437e

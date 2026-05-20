import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'

  const electronPlugin = electron([
    {
      entry: 'electron/index.js',
      onstart(options) {
        const cp = options.startup()
        // Electron 退出时，Vite 也优雅退出（退出码 0），避免 PID 丢失报错
        cp?.on('close', () => process.exit(0))
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
      entry: 'electron/preload.cjs',
      onstart(options) {
        if (process.env.NODE_ENV !== 'production') {
          options.reload()
        }
      },
      vite: {
        build: {
          outDir: 'dist-electron',
          rollupOptions: {
            external: ['electron']
          }
        }
      }
    }
  ])

  return {
    plugins: [
      vue(),
      ...(isElectron ? [
        electronPlugin,
        renderer()
      ] : [])
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler'
        }
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    }
  }
})

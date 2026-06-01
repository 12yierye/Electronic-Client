import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'

  const electronPlugin = electron([
    {
      entry: 'electron/index.js',
      onstart(options) {
        if (process.env.NODE_ENV !== 'production') {
          options.startup()
        }
      },
      vite: {
        build: {
          outDir: 'dist-electron',
          rollupOptions: {
            external: ['electron', 'axios', 'ws', 'pptxgenjs']
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
      AutoImport({
        imports: ['vue'],
        resolvers: [ElementPlusResolver()],
        dts: false
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: false
      }),
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
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      target: 'esnext',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('marked')) return 'marked'
            }
          }
        }
      }
    },
    esbuild: {
      drop: mode === 'electron' ? ['console', 'debugger'] : []
    }
  }
})

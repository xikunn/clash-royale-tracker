import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@': resolve('src') }
    },
    build: {
      lib: {
        entry: resolve('electron/main.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/preload.ts')
      }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: { '@': resolve('src') }
    },
    root: resolve('src/overlay'),
    build: {
      rollupOptions: {
        input: resolve('src/overlay/index.html')
      }
    }
  }
})

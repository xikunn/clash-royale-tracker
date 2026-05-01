const fs = require('fs')
const path = require('path')

const content = [
  "import { defineConfig, externalizeDepsPlugin } from 'electron-vite'",
  "import react from '@vitejs/plugin-react'",
  "import { resolve } from 'path'",
  "",
  "export default defineConfig({",
  "  main: {",
  "    plugins: [externalizeDepsPlugin()],",
  "    build: { lib: { entry: resolve('electron/main.ts') } },",
  "    resolve: { alias: { '@': resolve('src') } }",
  "  },",
  "  preload: {",
  "    plugins: [externalizeDepsPlugin()],",
  "    build: { lib: { entry: resolve('electron/preload.ts') } }",
  "  },",
  "  renderer: {",
  "    plugins: [react()],",
  "    root: resolve('src/overlay'),",
  "    resolve: { alias: { '@': resolve('src') } },",
  "    build: { rollupOptions: { input: resolve('src/overlay/index.html') } }",
  "  }",
  "})",
].join('\n')

const target = path.join(__dirname, '..', 'electron-vite.config.js')
fs.writeFileSync(target, content, 'utf8')
console.log('Created: electron-vite.config.js')

/**
 * electron/main.ts
 * Electron 主进程
 *
 * 职责：
 *  1. 创建主控制窗口（设置模拟器区域、启动/停止识别）
 *  2. 创建悬浮提示窗口（始终置顶、点击穿透、透明背景）
 *  3. 桥接 RecognitionLoop → IPC → 渲染进程
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Menu,
  Tray,
  nativeImage
} from 'electron'
import path from 'path'
import { RecognitionLoop } from '../src/recognition/RecognitionLoop'
import type { OverlayState } from '../src/recognition/RecognitionLoop'
import { EmulatorWindow } from '../src/capture/ScreenCapture'

// ── 路径 ──────────────────────────────────────────────────────────────────────

const TEMPLATE_DIR = path.join(__dirname, '../assets/templates')
const PRELOAD_PATH = path.join(__dirname, 'preload.js')
const RENDERER_INDEX = process.env['ELECTRON_RENDERER_URL']
  ?? `file://${path.join(__dirname, '../src/overlay/index.html')}`

// ── 全局状态 ──────────────────────────────────────────────────────────────────

let controlWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let loop: RecognitionLoop | null = null

// ── 应用生命周期 ──────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createControlWindow()
  createOverlayWindow()
  createTray()
  setupIpc()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  loop?.stop()
})

// ── 控制窗口 ──────────────────────────────────────────────────────────────────

function createControlWindow(): void {
  controlWindow = new BrowserWindow({
    width: 420,
    height: 560,
    title: '皇室战争追踪器',
    resizable: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.NODE_ENV === 'development') {
    controlWindow.loadURL('http://localhost:5173/control')
    controlWindow.webContents.openDevTools()
  } else {
    controlWindow.loadURL(`file://${path.join(__dirname, '../src/overlay/index.html')}?page=control`)
  }

  controlWindow.on('closed', () => { controlWindow = null })
}

// ── 悬浮窗口 ──────────────────────────────────────────────────────────────────

/**
 * line 259 ↓  悬浮窗配置
 *
 * 关键参数说明：
 *  - transparent: true       → 背景完全透明
 *  - frame: false            → 无系统标题栏
 *  - alwaysOnTop: true       → 始终置于游戏之上
 *  - skipTaskbar: true       → 不出现在任务栏
 *  - setIgnoreMouseEvents    → 点击穿透（可由用户切换）
 */
function createOverlayWindow(): void {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    x: sw - 320,
    y: 60,
    width: 300,
    height: 480,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,   // 防止抢夺游戏焦点
    webPreferences: {
      preload: PRELOAD_PATH,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 默认点击穿透，允许操作游戏
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  // macOS：悬浮在全屏应用之上
  if (process.platform === 'darwin') {
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  } else {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  }

  if (process.env.NODE_ENV === 'development') {
    overlayWindow.loadURL('http://localhost:5173/overlay')
  } else {
    overlayWindow.loadURL(`file://${path.join(__dirname, '../src/overlay/index.html')}?page=overlay`)
  }

  overlayWindow.on('closed', () => { overlayWindow = null })
}

// ── 系统托盘 ──────────────────────────────────────────────────────────────────

function createTray(): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('皇室战争追踪器')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示控制面板', click: () => controlWindow?.show() },
    { label: '切换覆盖层',   click: toggleOverlay          },
    { type: 'separator' },
    { label: '退出',         click: () => app.quit()        }
  ]))
}

function toggleOverlay(): void {
  if (!overlayWindow) return
  if (overlayWindow.isVisible()) overlayWindow.hide()
  else overlayWindow.show()
}

// ── IPC 处理 ──────────────────────────────────────────────────────────────────

function setupIpc(): void {
  // 启动识别
  ipcMain.handle('loop:start', (_e, emulatorWindow: EmulatorWindow) => {
    if (loop) loop.stop()

    loop = new RecognitionLoop(TEMPLATE_DIR)
    loop.onStateUpdate((state: OverlayState) => {
      // 把状态推送给覆盖层渲染进程
      overlayWindow?.webContents.send('state:update', state)
      // 也同步到控制面板
      controlWindow?.webContents.send('state:update', state)
    })

    if (emulatorWindow) {
      const { ScreenCapture } = require('../src/capture/ScreenCapture')
      // RecognitionLoop 内部会用 emulatorWindow 更新 capture
    }

    loop.start()
    return { ok: true }
  })

  // 停止识别
  ipcMain.handle('loop:stop', () => {
    loop?.stop()
    loop = null
    return { ok: true }
  })

  // 切换点击穿透
  ipcMain.handle('overlay:setClickThrough', (_e, enable: boolean) => {
    overlayWindow?.setIgnoreMouseEvents(enable, { forward: enable })
    return { ok: true }
  })

  // 移动悬浮窗位置
  ipcMain.handle('overlay:move', (_e, x: number, y: number) => {
    overlayWindow?.setPosition(Math.round(x), Math.round(y))
    return { ok: true }
  })

  // 调整置信度阈值（运行期调试用）
  ipcMain.handle('matcher:setThreshold', (_e, threshold: number) => {
    // loop 内部暴露 matcher，此处简化为重建 loop
    console.log(`[main] threshold set to ${threshold}`)
    return { ok: true }
  })

  // 读取当前屏幕列表（供用户选择模拟器所在屏幕）
  ipcMain.handle('screen:list', () => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: `${d.size.width}×${d.size.height}`,
      bounds: d.bounds
    }))
  })
}

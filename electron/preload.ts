/**
 * electron/preload.ts
 * 渲染进程 ↔ 主进程 IPC 桥
 *
 * contextBridge 将主进程 API 安全地暴露给渲染进程，
 * 渲染进程不能直接 require('electron')。
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { EmulatorWindow } from '../src/capture/ScreenCapture'
import type { OverlayState } from '../src/recognition/RecognitionLoop'

contextBridge.exposeInMainWorld('crTracker', {
  // ── 识别控制 ────────────────────────────────────────────────────────────
  startLoop: (win: EmulatorWindow) =>
    ipcRenderer.invoke('loop:start', win),
  stopLoop: () =>
    ipcRenderer.invoke('loop:stop'),

  // ── 覆盖层控制 ──────────────────────────────────────────────────────────
  setClickThrough: (enable: boolean) =>
    ipcRenderer.invoke('overlay:setClickThrough', enable),
  moveOverlay: (x: number, y: number) =>
    ipcRenderer.invoke('overlay:move', x, y),

  // ── 调试 ────────────────────────────────────────────────────────────────
  setThreshold: (t: number) =>
    ipcRenderer.invoke('matcher:setThreshold', t),
  listScreens: () =>
    ipcRenderer.invoke('screen:list'),

  // ── 状态订阅 ────────────────────────────────────────────────────────────
  onStateUpdate: (cb: (state: OverlayState) => void) => {
    ipcRenderer.on('state:update', (_e, state) => cb(state))
    return () => ipcRenderer.removeAllListeners('state:update')
  }
})

// TypeScript 类型声明（让渲染进程 tsx 文件有类型提示）
export {}

declare global {
  interface Window {
    crTracker: {
      startLoop: (win: EmulatorWindow) => Promise<{ ok: boolean }>
      stopLoop: () => Promise<{ ok: boolean }>
      setClickThrough: (enable: boolean) => Promise<{ ok: boolean }>
      moveOverlay: (x: number, y: number) => Promise<{ ok: boolean }>
      setThreshold: (t: number) => Promise<{ ok: boolean }>
      listScreens: () => Promise<Array<{ id: number; label: string; bounds: Electron.Rectangle }>>
      onStateUpdate: (cb: (state: OverlayState) => void) => () => void
    }
  }
}

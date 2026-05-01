/**
 * WindowFinder.ts
 * 自动检测模拟器窗口在屏幕上的位置
 * 支持随意拖动模拟器，程序自动跟踪
 */

import { execSync } from 'child_process'
import type { Rect } from './ScreenCapture'

export interface WindowInfo {
  title: string
  rect: Rect      // 窗口在屏幕上的完整区域
  gameRect: Rect  // 实际游戏画面区域（去掉边框）
}

// MuMuNxDevice 是纯游戏画面窗口，无标题栏，边框为 0
const BORDER = { top: 0, left: 0, right: 0, bottom: 0 }

export class WindowFinder {
  private cached: WindowInfo | null = null
  private lastCheck = 0
  private readonly CACHE_MS = 5000

  find(): WindowInfo | null {
    const now = Date.now()
    if (this.cached && now - this.lastCheck < this.CACHE_MS) {
      return this.cached
    }

    const info = this.findMuMuNxDevice()
    if (info) {
      this.cached = info
      this.lastCheck = now
      return info
    }

    if (this.cached) {
      console.warn('[WindowFinder] Window lost, using last known position')
      return this.cached
    }

    console.error('[WindowFinder] MuMuNxDevice not found')
    return null
  }

  invalidate(): void {
    this.cached = null
  }

  /**
   * 直接通过进程名 MuMuNxDevice 找游戏画面窗口
   * 用 PowerShell 文件避免命令行长度限制
   */
  private findMuMuNxDevice(): WindowInfo | null {
    try {
      const output = execSync(
        'powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\find-window.ps1',
        { timeout: 2000, windowsHide: true }
      ).toString()

      // 找 MuMuNxDevice 那一行
      const line = output.split('\n').find(l => l.includes('MuMuNxDevice'))
      if (!line) return null

      const m = line.match(/left=(-?\d+)\s+top=(-?\d+)\s+w=(\d+)\s+h=(\d+)/)
      if (!m) return null

      const left = parseInt(m[1])
      const top  = parseInt(m[2])
      const w    = parseInt(m[3])
      const h    = parseInt(m[4])

      if (w < 100 || h < 200) return null

      const gameRect: Rect = {
        x: left + BORDER.left,
        y: top  + BORDER.top,
        w: w - BORDER.left - BORDER.right,
        h: h - BORDER.top  - BORDER.bottom,
      }

      console.log(`[WindowFinder] MuMuNxDevice at x=${gameRect.x} y=${gameRect.y} w=${gameRect.w} h=${gameRect.h}`)
      return { title: 'MuMuNxDevice', rect: { x: left, y: top, w, h }, gameRect }
    } catch {
      return null
    }
  }
}

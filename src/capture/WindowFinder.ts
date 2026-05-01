/**
 * WindowFinder.ts
 * 自动检测模拟器窗口在屏幕上的位置
 *
 * 原理：用 PowerShell 调用 Windows API 的 FindWindow + GetWindowRect，
 * 每次截图前刷新一次，用户可以随意拖动模拟器。
 *
 * 支持的模拟器（按优先级）：
 *  - MuMu Player 12（MuMu模拟器12）
 *  - BlueStacks 5
 *  - LDPlayer
 *  - NoxPlayer
 */

import { execSync } from 'child_process'
import type { Rect } from './ScreenCapture'

// ── 各模拟器的窗口标题关键词 ──────────────────────────────────────────────────

const EMULATOR_TITLES = [
  'MuMu模拟器12',
  'MuMu Player',
  'BlueStacks',
  'LDPlayer',
  'Nox',
  'MEmu',
]

// PowerShell 脚本：找到窗口并返回坐标
// 用进程名模糊匹配 MuMu 主窗口，避免中文标题编码问题
const PS_FIND_MUMU = `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
}
public struct RECT { public int Left,Top,Right,Bottom; }
"@
$procs = Get-Process | Where-Object { $_.Name -like '*MuMu*' -and $_.MainWindowHandle -ne 0 }
foreach ($p in $procs) {
  $r = New-Object RECT
  if ([Win32]::GetWindowRect($p.MainWindowHandle, [ref]$r)) {
    $w = $r.Right - $r.Left
    $h = $r.Bottom - $r.Top
    if ($w -gt 100 -and $h -gt 200) {
      Write-Output "$($r.Left) $($r.Top) $($r.Right) $($r.Bottom)"
      exit 0
    }
  }
}
exit 1
`

const PS_SCRIPT = (title: string) => `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
}
public struct RECT { public int Left,Top,Right,Bottom; }
"@
$hwnd = [Win32]::FindWindow($null, "${title}")
if ($hwnd -eq [IntPtr]::Zero) { exit 1 }
$r = New-Object RECT
[Win32]::GetWindowRect($hwnd, [ref]$r) | Out-Null
Write-Output "$($r.Left) $($r.Top) $($r.Right) $($r.Bottom)"
`

export interface WindowInfo {
  title: string
  rect: Rect        // 整个模拟器窗口（含标题栏、边框）
  gameRect: Rect    // 估算的游戏画面区域（去掉边框）
}

// MuMu Player 12 的窗口边框大致尺寸（像素）
// 上边框（标题栏+菜单栏）约 80px，左右下边框约 8px
const BORDER = { top: 80, left: 8, right: 8, bottom: 8 }

export class WindowFinder {
  private cached: WindowInfo | null = null
  private lastCheck = 0
  private readonly CACHE_MS = 2000   // 每 2 秒重新检测一次

  /**
   * 获取模拟器窗口信息。
   * 有缓存时直接返回，避免每帧都调用 PowerShell（太慢）。
   */
  find(): WindowInfo | null {
    const now = Date.now()
    if (this.cached && now - this.lastCheck < this.CACHE_MS) {
      return this.cached
    }

    // 优先用进程名模糊匹配（解决中文窗口标题编码问题）
    const mumuInfo = this.findByPs(PS_FIND_MUMU, 'MuMu(process)')
    if (mumuInfo) {
      this.cached = mumuInfo
      this.lastCheck = now
      return mumuInfo
    }

    // 降级：按精确窗口标题匹配
    for (const title of EMULATOR_TITLES) {
      const info = this.findByTitle(title)
      if (info) {
        this.cached = info
        this.lastCheck = now
        console.log(`[WindowFinder] Found: "${title}" at`, info.gameRect)
        return info
      }
    }

    if (this.cached) {
      console.warn('[WindowFinder] Emulator window lost, using last known position')
      return this.cached
    }

    console.error('[WindowFinder] No emulator window found')
    return null
  }

  private findByPs(psScript: string, label: string): WindowInfo | null {
    return this.parseOutput(
      this.runPs(psScript.replace(/\n/g, ' ')),
      label
    )
  }

  private findByTitle(title: string): WindowInfo | null {
    return this.parseOutput(
      this.runPs(PS_SCRIPT(title).replace(/\n/g, ' ').replace(/"/g, '\\"')),
      title
    )
  }

  private runPs(cmd: string): string | null {
    try {
      return execSync(
        `powershell -NoProfile -Command "${cmd}"`,
        { timeout: 1500, windowsHide: true }
      ).toString().trim()
    } catch {
      return null
    }
  }

  private parseOutput(output: string | null, label: string): WindowInfo | null {
    if (!output) return null
    const parts = output.split(' ').map(Number)
    if (parts.length !== 4 || parts.some(isNaN)) return null

    const [left, top, right, bottom] = parts
    const w = right - left
    const h = bottom - top
    if (w <= 0 || h <= 0) return null

    const gameRect: Rect = {
      x: left + BORDER.left,
      y: top  + BORDER.top,
      w: w - BORDER.left - BORDER.right,
      h: h - BORDER.top  - BORDER.bottom,
    }

    console.log(`[WindowFinder] Found "${label}" at`, gameRect)
    return { title: label, rect: { x: left, y: top, w, h }, gameRect }
  }

  /** 强制清除缓存，下次 find() 时重新检测 */
  invalidate(): void {
    this.cached = null
  }
}

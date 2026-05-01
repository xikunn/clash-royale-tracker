/**
 * ElixirTracker.ts
 * 圣水计算器
 *
 * 皇室战争圣水规则：
 *  - 正常：每 2.8s 回复 1 点（0 → 10）
 *  - 双倍圣水时间（最后 60s）：每 1.4s 回复 1 点
 *  - 玩家出牌时扣除对应费用
 *
 * 本模块用两种方式追踪圣水：
 *  1. 视觉读取：扫描圣水条蓝色像素宽度（定期刷新）
 *  2. 推算：基于游戏计时器 + 出牌记录计算期望值
 * 两者做加权融合，提高准确度。
 */

// ── 常量 ──────────────────────────────────────────────────────────────────────

const MAX_ELIXIR = 10
const REGEN_RATE_NORMAL = 1 / 2.8      // 点/ms → 换算时乘以 1000
const REGEN_RATE_DOUBLE = 1 / 1.4
const DOUBLE_ELIXIR_THRESHOLD_MS = 60_000  // 倒计时 60s 进入双倍

// ── 类型 ──────────────────────────────────────────────────────────────────────

export interface ElixirState {
  estimated: number     // 推算值 [0, 10]，保留一位小数
  visual: number | null // 视觉读取值（null = 本帧未读取）
  isDoubleElixir: boolean
  ratePerSec: number    // 当前每秒回复速率
}

// ── 核心类 ────────────────────────────────────────────────────────────────────

export class ElixirTracker {
  private current = 5.0              // 初始假定 5 点（游戏开局约为此值）
  private lastUpdateTime = Date.now()
  private doubleElixirActive = false

  /** 每帧由识别循环调用，传入当前游戏剩余时间（毫秒） */
  tick(remainingMs: number): void {
    const now = Date.now()
    const dt = now - this.lastUpdateTime
    this.lastUpdateTime = now

    this.doubleElixirActive = remainingMs <= DOUBLE_ELIXIR_THRESHOLD_MS

    const rate = this.doubleElixirActive ? REGEN_RATE_DOUBLE : REGEN_RATE_NORMAL
    this.current = Math.min(MAX_ELIXIR, this.current + rate * dt)
  }

  /**
   * 记录一次己方出牌（扣除圣水）
   */
  spend(elixirCost: number): void {
    this.current = Math.max(0, this.current - elixirCost)
  }

  /**
   * 用视觉读取值修正推算值（防止长期误差累积）
   * visualValue: 0–10
   */
  correct(visualValue: number): void {
    // 简单加权：视觉读取权重 0.6，推算值权重 0.4
    this.current = visualValue * 0.6 + this.current * 0.4
  }

  getState(): ElixirState {
    return {
      estimated: Math.round(this.current * 10) / 10,
      visual: null,
      isDoubleElixir: this.doubleElixirActive,
      ratePerSec: this.doubleElixirActive ? REGEN_RATE_DOUBLE * 1000 : REGEN_RATE_NORMAL * 1000
    }
  }

  reset(): void {
    this.current = 5.0
    this.lastUpdateTime = Date.now()
    this.doubleElixirActive = false
  }
}

// ── 圣水条视觉解析（独立函数，配合 ScreenCapture 使用）───────────────────────

import Jimp from 'jimp'
import { ELIXIR_BAR, ELIXIR_COLOR } from '../protocol/ClashRoyaleProtocol'
import type { CaptureResult } from '../capture/ScreenCapture'

/**
 * 从截图中解析圣水条，返回估算的圣水值（0–10）。
 * 原理：计算圣水条区域内蓝色像素的比例 × 10。
 */
export async function readElixirBar(frame: CaptureResult): Promise<number> {
  const { x, y, w, h } = ELIXIR_BAR()   // 动态计算坐标
  const bar = frame.jimp.clone().crop(x, y, w, h)

  let bluePixels = 0
  const total = w * h

  bar.scan(0, 0, w, h, (_, __, idx) => {
    const r = bar.bitmap.data[idx]
    const g = bar.bitmap.data[idx + 1]
    const b = bar.bitmap.data[idx + 2]

    const { h: hVal, s, v } = rgbToHsv(r, g, b)

    if (
      hVal >= ELIXIR_COLOR.hMin &&
      hVal <= ELIXIR_COLOR.hMax &&
      s >= ELIXIR_COLOR.sMin &&
      v >= ELIXIR_COLOR.vMin
    ) {
      bluePixels++
    }
  })

  return (bluePixels / total) * MAX_ELIXIR
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + 6) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
  }

  return {
    h,
    s: max === 0 ? 0 : (d / max) * 100,
    v: max * 100
  }
}

/**
 * RecognitionLoop.ts
 * 主识别循环 —— 帧差方案
 *
 * 每帧流程：
 *  1. captureGame() 截图
 *  2. diffWithPrev() 找出对方半场的变化区域
 *  3. 只对变化区域做模板匹配（跳过静止区域）
 *  4. 匹配成功 → DeckTracker.recordPlay()
 *  5. 读圣水条 → ElixirTracker.correct()
 *  6. 广播 OverlayState 给渲染进程
 *
 * 为什么用帧差而不是全图扫描：
 *  - 对方放卡瞬间单位刚落地，遮挡最少，正是最好识别的一帧
 *  - 只处理变化区域，CPU 占用降低 80%+
 *  - 误报率低：静止的塔、草地、UI 不会触发
 */

import { ScreenCapture } from '../capture/ScreenCapture'
import { TemplateMatcher } from './TemplateMatcher'
import { DeckTracker } from '../tracker/DeckTracker'
import { ElixirTracker, readElixirBar } from '../tracker/ElixirTracker'
import { ARENA_OPPONENT_HALF, TEMPLATE_SIZE } from '../protocol/ClashRoyaleProtocol'
import type { DeckState } from '../tracker/DeckTracker'
import type { ElixirState } from '../tracker/ElixirTracker'

export interface OverlayState {
  deck: DeckState
  elixir: ElixirState
  fps: number
  lastUpdated: number
}

type StateCallback = (state: OverlayState) => void

// 帧间隔：500ms（2 FPS）。
// 皇室战争放卡动画约持续 600ms，500ms 足以捕到落地帧。
const FRAME_INTERVAL_MS = 500

// 如果整体变化比例超过这个值，说明场面大变（如进入结算画面），跳过本帧
const MAX_CHANGE_RATIO = 0.4

export class RecognitionLoop {
  private capture: ScreenCapture
  private matcher: TemplateMatcher
  private deckTracker: DeckTracker
  private elixirTracker: ElixirTracker
  private callbacks: StateCallback[] = []
  private running = false
  private timer: NodeJS.Timeout | null = null
  private gameStartTime = Date.now()

  // FPS 统计
  private frameCount = 0
  private lastFpsTime = Date.now()
  private fps = 0

  // 同一张卡的去重冷却（避免连续多帧都检测到同一张刚放下的卡）
  private recentPlays: Map<string, number> = new Map()
  private readonly DEDUP_COOLDOWN_MS = 3000

  constructor(templateDir: string) {
    this.capture = new ScreenCapture()
    this.matcher = new TemplateMatcher(0.82)
    this.deckTracker = new DeckTracker()
    this.elixirTracker = new ElixirTracker()

    this.matcher.loadFromDir(templateDir).catch(console.error)
  }

  onStateUpdate(cb: StateCallback): void {
    this.callbacks.push(cb)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.gameStartTime = Date.now()
    this.deckTracker.reset()
    this.elixirTracker.reset()
    this.recentPlays.clear()
    this.scheduleNext()
    console.log('[RecognitionLoop] Started — frame diff mode')
  }

  stop(): void {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    console.log('[RecognitionLoop] Stopped')
  }

  private scheduleNext(): void {
    this.timer = setTimeout(() => this.runFrame(), FRAME_INTERVAL_MS)
  }

  private async runFrame(): Promise<void> {
    if (!this.running) return
    try {
      await this.processFrame()
    } catch (err) {
      console.error('[RecognitionLoop] Frame error:', err)
    }
    this.updateFps()
    this.scheduleNext()
  }

  private async processFrame(): Promise<void> {
    // ── 1. 截图 ──────────────────────────────────────────────────────────────
    const frame = await this.capture.captureGame()

    // ── 2. 圣水追踪（每帧都做，与识别解耦）──────────────────────────────────
    const elapsed = Date.now() - this.gameStartTime
    const remainingMs = Math.max(0, 3 * 60_000 - elapsed)
    this.elixirTracker.tick(remainingMs)

    const visualElixir = await readElixirBar(frame)
    this.elixirTracker.correct(visualElixir)

    // ── 3. 帧差：找对方半场的变化区域 ────────────────────────────────────────
    const diff = this.capture.diffWithPrev(frame, ARENA_OPPONENT_HALF)

    // 变化过大（结算/切换画面）或没有变化，跳过识别
    if (diff.changeRatio > MAX_CHANGE_RATIO || diff.regions.length === 0) {
      this.broadcast(frame.timestamp)
      return
    }

    console.log(
      `[RecognitionLoop] ${diff.regions.length} changed region(s), ratio=${diff.changeRatio.toFixed(3)}`
    )

    // ── 4. 只对变化区域做模板匹配 ────────────────────────────────────────────
    const candidates = await this.capture.cropMany(frame, diff.regions, TEMPLATE_SIZE)
    const results = this.matcher.matchMany(candidates)

    for (const result of results) {
      if (!result.matched) continue
      if (this.isDuplicate(result.cardId)) continue

      console.log(`[RecognitionLoop] Detected: ${result.cardId} (${(result.confidence * 100).toFixed(1)}%)`)
      this.deckTracker.recordPlay(result.cardId, frame.timestamp)
      this.recentPlays.set(result.cardId, Date.now())
    }

    // ── 5. 广播 ──────────────────────────────────────────────────────────────
    this.broadcast(frame.timestamp)
  }

  /**
   * 同一张卡在 DEDUP_COOLDOWN_MS 内重复识别到，认为是同一次出牌，忽略
   */
  private isDuplicate(cardId: string): boolean {
    const last = this.recentPlays.get(cardId)
    if (!last) return false
    return Date.now() - last < this.DEDUP_COOLDOWN_MS
  }

  private broadcast(timestamp: number): void {
    const state: OverlayState = {
      deck: this.deckTracker.getState(),
      elixir: { ...this.elixirTracker.getState(), visual: null },
      fps: this.fps,
      lastUpdated: timestamp
    }
    for (const cb of this.callbacks) cb(state)
  }

  private updateFps(): void {
    this.frameCount++
    const now = Date.now()
    const elapsed = now - this.lastFpsTime
    if (elapsed >= 2000) {
      this.fps = Math.round((this.frameCount / elapsed) * 1000)
      this.frameCount = 0
      this.lastFpsTime = now
    }
  }
}

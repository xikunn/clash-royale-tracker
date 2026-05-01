/**
 * ScreenCapture.ts
 * 固定区域截图 + 图像预处理 + 帧差检测
 * 支持自动检测模拟器窗口位置（WindowFinder）
 */

// screenshot-desktop has no official @types package — using require cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const screenshot: any = require('screenshot-desktop')
import Jimp from 'jimp'
import { WindowFinder } from './WindowFinder'

// ── 类型 ──────────────────────────────────────────────────────────────────────

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface CaptureResult {
  raw: Buffer
  jimp: Jimp
  timestamp: number
}

export interface EmulatorWindow {
  screenIndex: number
  rect: Rect
}

/**
 * 帧差结果：本帧相比上一帧，新出现内容的候选区域列表
 * （已合并相邻小块，过滤掉噪声）
 */
export interface DiffResult {
  regions: Rect[]       // 变化区域（游戏画面坐标系）
  changeRatio: number   // 整体变化比例 0–1，用于判断是否有新内容
}

const DEFAULT_WINDOW: EmulatorWindow = {
  screenIndex: 0,
  rect: { x: 0, y: 0, w: 450, h: 800 }
}

// ── 核心类 ────────────────────────────────────────────────────────────────────

export class ScreenCapture {
  private window: EmulatorWindow
  private prevGray: Jimp | null = null
  private finder: WindowFinder
  private autoDetect: boolean

  /**
   * @param window     手动指定窗口区域（autoDetect=false 时使用）
   * @param autoDetect true = 每帧自动检测模拟器窗口位置（推荐）
   */
  constructor(window: EmulatorWindow = DEFAULT_WINDOW, autoDetect = true) {
    this.window = window
    this.finder = new WindowFinder()
    this.autoDetect = autoDetect
  }

  setWindow(window: EmulatorWindow): void {
    this.window = window
    this.prevGray = null
  }

  // ── 截图 ──────────────────────────────────────────────────────────────────

  async captureGame(): Promise<CaptureResult> {
    // 自动检测模拟器窗口位置
    if (this.autoDetect) {
      const info = this.finder.find()
      if (info) {
        const { x, y, w, h } = info.gameRect
        if (x !== this.window.rect.x || y !== this.window.rect.y) {
          this.prevGray = null
        }
        this.window = { screenIndex: 0, rect: info.gameRect }
        // 根据实际窗口尺寸自动缩放协议坐标
        const { setScale } = require('../protocol/ClashRoyaleProtocol')
        setScale(w, h)
      }
    }

    const screens = await screenshot.listDisplays()
    const display = screens[this.window.screenIndex] ?? screens[0]

    const fullBuf: Buffer = await screenshot({ screen: display.id, format: 'png' })
    const image = await Jimp.read(fullBuf)

    const { x, y, w, h } = this.window.rect
    image.crop(x, y, w, h)

    const raw = await image.getBufferAsync(Jimp.MIME_PNG)
    this.debugSave(image, 'game_full')

    return { raw, jimp: image, timestamp: Date.now() }
  }

  // ── 帧差检测 ──────────────────────────────────────────────────────────────

  /**
   * 对比当前帧和上一帧，返回变化区域。
   *
   * 流程：
   *  1. 把当前帧裁剪到对方半场（只关心对方出牌）
   *  2. 灰度化
   *  3. 逐像素和上一帧做绝对差
   *  4. 差值超过阈值的像素标为"变化点"
   *  5. 把相邻变化点合并成矩形区域
   *  6. 过滤掉太小的区域（噪声）
   *
   * @param current   当前帧
   * @param scanZone  只扫描这个区域（通常是对方半场）
   */
  diffWithPrev(current: CaptureResult, scanZone: Rect): DiffResult {
    // 裁出扫描区域的灰度图
    const curGray = current.jimp
      .clone()
      .crop(scanZone.x, scanZone.y, scanZone.w, scanZone.h)
      .grayscale()

    if (!this.prevGray) {
      this.prevGray = curGray
      return { regions: [], changeRatio: 0 }
    }

    const w = scanZone.w
    const h = scanZone.h
    const curData  = curGray.bitmap.data
    const prevData = this.prevGray.bitmap.data

    // 差异阈值：像素灰度差超过 40 认为有变化（0–255）
    const PIXEL_THRESHOLD = 40
    // 最小有效区域面积（像素），过滤摄像机噪声和小特效
    const MIN_REGION_AREA = 600   // 约 24×25 像素

    // 生成差异掩码
    const mask: boolean[] = new Array(w * h).fill(false)
    let changed = 0

    for (let i = 0; i < w * h; i++) {
      const diff = Math.abs(curData[i * 4] - prevData[i * 4])
      if (diff > PIXEL_THRESHOLD) {
        mask[i] = true
        changed++
      }
    }

    const changeRatio = changed / (w * h)

    // 把掩码里的连续变化块合并成矩形（简化版：按列扫描划分格子）
    const regions = this.extractRegions(mask, w, h, MIN_REGION_AREA)

    // 把区域坐标从 scanZone 局部坐标 转回 游戏画面坐标
    const globalRegions = regions.map((r) => ({
      x: r.x + scanZone.x,
      y: r.y + scanZone.y,
      w: r.w,
      h: r.h
    }))

    this.debugSaveDiff(curGray, globalRegions)

    // 更新上一帧
    this.prevGray = curGray

    return { regions: globalRegions, changeRatio }
  }

  /**
   * 从差异掩码中提取矩形区域。
   * 把整个掩码划分成 GRID_COLS × GRID_ROWS 个格子，
   * 格子内变化像素占比超过 20% 则认为该格子有新内容。
   * 相邻有内容的格子合并成一个大矩形。
   */
  private extractRegions(
    mask: boolean[],
    w: number,
    h: number,
    minArea: number
  ): Rect[] {
    const GRID_COLS = 6
    const GRID_ROWS = 8
    const cellW = Math.floor(w / GRID_COLS)
    const cellH = Math.floor(h / GRID_ROWS)
    const CELL_THRESHOLD = 0.20   // 格子内 20% 像素变化即触发

    // 统计每个格子的变化率
    const active: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
      new Array(GRID_COLS).fill(false)
    )

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        let cnt = 0
        const total = cellW * cellH
        for (let dy = 0; dy < cellH; dy++) {
          for (let dx = 0; dx < cellW; dx++) {
            const px = col * cellW + dx
            const py = row * cellH + dy
            if (px < w && py < h && mask[py * w + px]) cnt++
          }
        }
        active[row][col] = cnt / total > CELL_THRESHOLD
      }
    }

    // 把相邻激活格子合并成矩形（简单的行列扫描合并）
    const used: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
      new Array(GRID_COLS).fill(false)
    )
    const rects: Rect[] = []

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (!active[row][col] || used[row][col]) continue

        // 向右、向下扩展
        let maxCol = col
        let maxRow = row
        while (maxCol + 1 < GRID_COLS && active[row][maxCol + 1]) maxCol++
        outer: for (let r = row + 1; r < GRID_ROWS; r++) {
          for (let c = col; c <= maxCol; c++) {
            if (!active[r][c]) break outer
          }
          maxRow = r
        }

        // 标记已使用
        for (let r = row; r <= maxRow; r++)
          for (let c = col; c <= maxCol; c++)
            used[r][c] = true

        const rect: Rect = {
          x: col * cellW,
          y: row * cellH,
          w: (maxCol - col + 1) * cellW,
          h: (maxRow - row + 1) * cellH
        }

        if (rect.w * rect.h >= minArea) rects.push(rect)
      }
    }

    return rects
  }

  // ── 裁剪 & 预处理 ──────────────────────────────────────────────────────────

  /**
   * 裁剪子区域并预处理（灰度 → 归一化 → 缩放），输出给 TemplateMatcher。
   */
  async cropAndPreprocess(
    source: CaptureResult,
    region: Rect,
    targetSize?: { w: number; h: number }
  ): Promise<Jimp> {
    const img = source.jimp.clone().crop(region.x, region.y, region.w, region.h)
    img.grayscale().normalize()
    if (targetSize) img.resize(targetSize.w, targetSize.h, Jimp.RESIZE_BILINEAR)
    this.debugSave(img, `crop_${region.x}_${region.y}`)
    return img
  }

  async cropMany(
    source: CaptureResult,
    regions: Rect[],
    targetSize?: { w: number; h: number }
  ): Promise<Jimp[]> {
    return Promise.all(regions.map((r) => this.cropAndPreprocess(source, r, targetSize)))
  }

  // ── 调试工具 ──────────────────────────────────────────────────────────────

  private debugSave(img: Jimp, tag: string): void {
    if (process.env.DEBUG_SAVE !== 'true') return
    const fs   = require('fs')
    const os   = require('os')
    const path = require('path')
    const dir  = path.join(os.homedir(), 'cr_debug')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    img.write(path.join(dir, `${tag}_${Date.now()}.png`) as `${string}.png`)
  }

  /** 调试：在帧差图上画出检测到的矩形区域 */
  private debugSaveDiff(gray: Jimp, regions: Rect[]): void {
    if (process.env.DEBUG_SAVE !== 'true') return
    const marked = gray.clone()
    for (const r of regions) {
      // 在区域边缘画白色边框
      marked.scan(r.x, r.y, r.w, 2,         (x, y, idx) => { marked.bitmap.data[idx] = 255 })
      marked.scan(r.x, r.y + r.h - 2, r.w, 2, (x, y, idx) => { marked.bitmap.data[idx] = 255 })
      marked.scan(r.x, r.y, 2, r.h,         (x, y, idx) => { marked.bitmap.data[idx] = 255 })
      marked.scan(r.x + r.w - 2, r.y, 2, r.h, (x, y, idx) => { marked.bitmap.data[idx] = 255 })
    }
    this.debugSave(marked, `diff_regions`)
  }
}

/**
 * TemplateMatcher.ts
 * 模板匹配 + 置信度阈值
 *
 * 算法：归一化互相关（NCC，Normalized Cross-Correlation）
 *  - 对灰度像素逐像素计算，范围 [-1, 1]，1 = 完全匹配
 *  - 置信度阈值默认 0.82，可按卡牌视觉复杂度单独调整
 *
 * 为什么不用 OpenCV？
 *  MVP 阶段用纯 TS 实现，避免 native addon 的编译复杂性。
 *  识别稳定后可把 match() 替换为 cv.matchTemplate 提速 10x。
 */

import Jimp from 'jimp'

// ── 类型 ──────────────────────────────────────────────────────────────────────

/** line 20 ↓  单次匹配结果 */
export interface MatchResult {
  cardId: string       // 卡牌标识符，如 "fireball" | "giant"
  confidence: number   // NCC 得分 [0, 1]
  matched: boolean     // 是否超过置信度阈值
}

export interface CardTemplate {
  cardId: string
  image: Jimp          // 已预处理（灰度 + 归一化）的模板图
  threshold?: number   // 可覆盖全局阈值
}

// ── 常量 ──────────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 0.82

// ── 核心类 ────────────────────────────────────────────────────────────────────

export class TemplateMatcher {
  private templates: Map<string, CardTemplate> = new Map()
  private globalThreshold: number

  constructor(threshold = DEFAULT_THRESHOLD) {
    this.globalThreshold = threshold
  }

  // ── 模板管理 ──────────────────────────────────────────────────────────────

  /** 注册单张卡牌模板 */
  register(template: CardTemplate): void {
    this.templates.set(template.cardId, template)
  }

  /**
   * 从目录批量加载模板。
   * 文件命名约定：<cardId>.png，如 fireball.png
   */
  async loadFromDir(dir: string): Promise<void> {
    const fs = await import('fs')
    const path = await import('path')

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'))
    await Promise.all(
      files.map(async (file) => {
        const cardId = path.basename(file, '.png')
        const img = await Jimp.read(path.join(dir, file))
        img.grayscale().normalize()
        this.register({ cardId, image: img })
      })
    )
    console.log(`[TemplateMatcher] Loaded ${this.templates.size} templates from ${dir}`)
  }

  // ── 匹配逻辑 ──────────────────────────────────────────────────────────────

  /**
   * 将候选图与所有已注册模板做 NCC 匹配，返回最佳结果。
   * 候选图需已预处理（灰度 + 归一化，尺寸与模板一致）。
   */
  matchBest(candidate: Jimp): MatchResult {
    let best: MatchResult = { cardId: 'unknown', confidence: 0, matched: false }

    for (const [, template] of this.templates) {
      const score = this.ncc(candidate, template.image)
      if (score > best.confidence) {
        const threshold = template.threshold ?? this.globalThreshold
        best = {
          cardId: template.cardId,
          confidence: score,
          matched: score >= threshold
        }
      }
    }

    return best
  }

  /**
   * 批量匹配（如同时识别 4 张手牌）
   */
  matchMany(candidates: Jimp[]): MatchResult[] {
    return candidates.map((c) => this.matchBest(c))
  }

  // ── NCC 算法 ──────────────────────────────────────────────────────────────

  /**
   * 归一化互相关。两张图必须尺寸相同、已灰度化。
   * 返回值 [0, 1]，越高越相似。
   *
   * 公式：NCC = Σ[(f - f̄)(t - t̄)] / sqrt(Σ(f - f̄)² · Σ(t - t̄)²)
   */
  private ncc(candidate: Jimp, template: Jimp): number {
    // 统一尺寸（以模板为基准）
    const w = template.bitmap.width
    const h = template.bitmap.height
    const c = candidate.clone().resize(w, h, Jimp.RESIZE_BILINEAR)

    const cData = c.bitmap.data
    const tData = template.bitmap.data
    const n = w * h

    // 计算均值（只取 R 通道，已灰度化故 R=G=B）
    let cMean = 0
    let tMean = 0
    for (let i = 0; i < n; i++) {
      cMean += cData[i * 4]
      tMean += tData[i * 4]
    }
    cMean /= n
    tMean /= n

    // 计算 NCC 分子分母
    let numerator = 0
    let cVar = 0
    let tVar = 0
    for (let i = 0; i < n; i++) {
      const cf = cData[i * 4] - cMean
      const tf = tData[i * 4] - tMean
      numerator += cf * tf
      cVar += cf * cf
      tVar += tf * tf
    }

    const denominator = Math.sqrt(cVar * tVar)
    if (denominator === 0) return 0

    // 映射到 [0, 1]
    return (numerator / denominator + 1) / 2
  }

  // ── 调试工具 ──────────────────────────────────────────────────────────────

  /** 输出所有已加载模板的 cardId 列表 */
  listTemplates(): string[] {
    return [...this.templates.keys()]
  }

  /** 调整全局置信度阈值（用于现场调试） */
  setThreshold(t: number): void {
    this.globalThreshold = t
  }
}

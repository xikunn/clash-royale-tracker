/**
 * DeckTracker.ts
 * 对方卡组记忆器
 *
 * 皇室战争机制：
 *  - 每套牌 8 张，循环使用
 *  - 对方打出一张牌后，那张牌回到队尾等待再次使用
 *  - 只要见过 8 张不同的牌，就能推算出完整卡组
 *
 * 本模块职责：
 *  1. 接收识别到的对方出牌事件
 *  2. 维护"已见牌"列表与"循环队列"推算
 *  3. 输出卡组状态供悬浮窗显示
 */

import { CARD_REGISTRY, type CardMeta } from '../protocol/ClashRoyaleProtocol'

// ── 类型 ──────────────────────────────────────────────────────────────────────

export type CardStatus = 'unseen' | 'in_rotation' | 'just_played' | 'next_up'

export interface TrackedCard {
  meta: CardMeta
  status: CardStatus
  seenAt: number[]    // 被发现的时间戳（毫秒）
  playCount: number
}

export interface DeckState {
  knownCards: TrackedCard[]   // 已确认见过的牌（最多 8 张）
  unknownSlots: number        // 8 - knownCards.length
  cyclePosition: number       // 当前循环推算位置
  confidence: number          // 0–1，1 = 8 张全见
}

// ── 核心类 ────────────────────────────────────────────────────────────────────

export class DeckTracker {
  private deck: Map<string, TrackedCard> = new Map()
  private playOrder: string[] = []         // 按出牌顺序排列
  private cyclePosition = 0
  private readonly MAX_DECK_SIZE = 8

  /** 重置（开始新对局） */
  reset(): void {
    this.deck.clear()
    this.playOrder = []
    this.cyclePosition = 0
  }

  /**
   * 记录一次对方出牌事件。
   * 由 RecognitionLoop 在识别到对方出牌时调用。
   */
  recordPlay(cardId: string, timestamp = Date.now()): void {
    const meta = CARD_REGISTRY[cardId]
    if (!meta) {
      console.warn(`[DeckTracker] Unknown card: ${cardId}`)
      return
    }

    if (this.deck.has(cardId)) {
      const card = this.deck.get(cardId)!
      card.seenAt.push(timestamp)
      card.playCount++
      card.status = 'just_played'
    } else if (this.deck.size < this.MAX_DECK_SIZE) {
      this.deck.set(cardId, {
        meta,
        status: 'just_played',
        seenAt: [timestamp],
        playCount: 1
      })
      this.playOrder.push(cardId)
    }

    this.updateCyclePosition(cardId)

    // 500ms 后把 just_played 状态改回 in_rotation
    setTimeout(() => {
      const card = this.deck.get(cardId)
      if (card?.status === 'just_played') {
        card.status = 'in_rotation'
      }
    }, 500)
  }

  /**
   * 获取当前卡组状态（供 UI 消费）
   */
  getState(): DeckState {
    const knownCards = [...this.deck.values()]
    const known = this.deck.size

    // 推算 next_up：根据打出顺序，距离 cyclePosition 最近的牌
    this.markNextUp()

    return {
      knownCards,
      unknownSlots: this.MAX_DECK_SIZE - known,
      cyclePosition: this.cyclePosition,
      confidence: known / this.MAX_DECK_SIZE
    }
  }

  /**
   * 估算对方下一张出牌（只有 8 张全见时才可靠）
   */
  predictNext(): CardMeta | null {
    if (this.deck.size < this.MAX_DECK_SIZE) return null
    const nextId = this.playOrder[this.cyclePosition % this.MAX_DECK_SIZE]
    return this.deck.get(nextId)?.meta ?? null
  }

  // ── 内部工具 ──────────────────────────────────────────────────────────────

  private updateCyclePosition(cardId: string): void {
    const idx = this.playOrder.lastIndexOf(cardId)
    if (idx >= 0) {
      this.cyclePosition = (idx + 1) % this.MAX_DECK_SIZE
    }
  }

  private markNextUp(): void {
    if (this.deck.size < this.MAX_DECK_SIZE) return

    // 重置所有为 in_rotation
    for (const card of this.deck.values()) {
      if (card.status !== 'just_played') card.status = 'in_rotation'
    }

    // 标记下一张
    const nextId = this.playOrder[this.cyclePosition % this.MAX_DECK_SIZE]
    const next = this.deck.get(nextId)
    if (next && next.status !== 'just_played') {
      next.status = 'next_up'
    }
  }
}

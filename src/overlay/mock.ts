/**
 * mock.ts
 * 模拟识别数据，用于 UI 预览和调试
 * 不依赖截图、模板、模拟器
 */

import type { OverlayState } from '../recognition/RecognitionLoop'
import { CARD_REGISTRY } from '../protocol/ClashRoyaleProtocol'

// 模拟的对方卡组（8 张）
const MOCK_DECK = [
  'hog_rider', 'fireball', 'valkyrie', 'musketeer',
  'zap', 'cannon', 'minions', 'goblin_barrel'
]

let mockFrame = 0

export function getMockState(): OverlayState {
  mockFrame++

  // 随着帧数增加，逐渐"发现"更多对方的牌
  const revealedCount = Math.min(Math.floor(mockFrame / 3) + 1, 8)
  const revealedIds = MOCK_DECK.slice(0, revealedCount)

  // 模拟最近一张刚打出
  const justPlayedIdx = (mockFrame % revealedCount)

  const knownCards = revealedIds.map((id, i) => ({
    meta: CARD_REGISTRY[id]!,
    status: (
      i === justPlayedIdx ? 'just_played' :
      i === (justPlayedIdx + 1) % revealedCount && revealedCount === 8 ? 'next_up' :
      'in_rotation'
    ) as 'just_played' | 'next_up' | 'in_rotation' | 'unseen',
    seenAt: [Date.now()],
    playCount: i === justPlayedIdx ? 2 : 1
  }))

  // 圣水在 0-10 之间循环
  const elixirCycle = (mockFrame * 0.3) % 10

  // 超过第 20 帧进入双倍圣水
  const isDouble = mockFrame > 20

  return {
    deck: {
      knownCards,
      unknownSlots: 8 - revealedCount,
      cyclePosition: justPlayedIdx,
      confidence: revealedCount / 8
    },
    elixir: {
      estimated: Math.round(elixirCycle * 10) / 10,
      visual: elixirCycle,
      isDoubleElixir: isDouble,
      ratePerSec: isDouble ? 1 / 1.4 : 1 / 2.8
    },
    fps: 2,
    lastUpdated: Date.now()
  }
}

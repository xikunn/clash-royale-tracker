/**
 * DeckPanel.tsx
 * 显示对方卡组的 8 张槽位
 *
 * 卡牌状态颜色：
 *  just_played  → 红色边框（刚打出）
 *  next_up      → 金色边框 + 角标（即将出现）
 *  in_rotation  → 正常白色
 *  unseen       → 灰色虚线（未见过）
 */

import React from 'react'
import type { DeckState, TrackedCard, CardStatus } from '../../tracker/DeckTracker'

interface Props {
  deck: DeckState
}

export function DeckPanel({ deck }: Props): React.ReactElement {
  const { knownCards, unknownSlots, confidence } = deck

  const confidencePct = Math.round(confidence * 100)

  return (
    <div style={styles.container}>
      <div style={styles.sectionTitle}>
        对方卡组
        <span style={styles.confidence}>{confidencePct}%</span>
      </div>

      <div style={styles.grid}>
        {/* 已见卡牌 */}
        {knownCards.map((card) => (
          <CardSlot key={card.meta.id} card={card} />
        ))}

        {/* 未见槽位 */}
        {Array.from({ length: unknownSlots }).map((_, i) => (
          <UnknownSlot key={`unknown-${i}`} />
        ))}
      </div>

      {/* 下一张预测 */}
      {confidence >= 1 && (
        <NextCardHint cards={knownCards} cyclePosition={deck.cyclePosition} />
      )}
    </div>
  )
}

// ── 单张卡牌 ──────────────────────────────────────────────────────────────────

function CardSlot({ card }: { card: TrackedCard }): React.ReactElement {
  const { meta, status, playCount } = card
  const borderColor = STATUS_COLORS[status]

  return (
    <div style={{ ...styles.card, borderColor }}>
      <div style={styles.cardName}>{meta.displayName}</div>
      <div style={styles.cardCost}>
        <span style={styles.elixirDot}>💧</span>
        {meta.elixirCost}
      </div>
      {playCount > 1 && (
        <div style={styles.playCount}>×{playCount}</div>
      )}
      {status === 'just_played' && <div style={styles.playedBadge}>打出</div>}
      {status === 'next_up'     && <div style={styles.nextBadge}>↑下</div>}
    </div>
  )
}

function UnknownSlot(): React.ReactElement {
  return (
    <div style={styles.unknownCard}>
      <span style={{ color: '#555', fontSize: 18 }}>?</span>
    </div>
  )
}

function NextCardHint({
  cards,
  cyclePosition
}: {
  cards: TrackedCard[]
  cyclePosition: number
}): React.ReactElement {
  const next = cards[cyclePosition % cards.length]
  if (!next) return <></>

  return (
    <div style={styles.nextHint}>
      对方下一张：
      <strong style={{ color: '#ffd700' }}>{next.meta.displayName}</strong>
      （{next.meta.elixirCost}💧）
    </div>
  )
}

// ── 颜色映射 ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CardStatus, string> = {
  just_played:  '#e74c3c',
  next_up:      '#f1c40f',
  in_rotation:  'rgba(255,255,255,0.3)',
  unseen:       '#555'
}

// ── 样式 ──────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 11,
    color: '#aaa',
    marginBottom: 6,
    display: 'flex',
    justifyContent: 'space-between'
  },
  confidence: {
    color: '#c9a84c',
    fontWeight: 700
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 4
  },
  card: {
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid',
    borderRadius: 6,
    padding: '4px 3px',
    textAlign: 'center',
    position: 'relative',
    minHeight: 54
  },
  cardName: {
    fontSize: 10,
    lineHeight: 1.2,
    marginBottom: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  cardCost: {
    fontSize: 12,
    fontWeight: 700,
    color: '#a78bfa'
  },
  elixirDot: { fontSize: 9, marginRight: 1 },
  playCount: {
    position: 'absolute',
    top: 2,
    right: 3,
    fontSize: 9,
    color: '#888'
  },
  playedBadge: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    fontSize: 9,
    color: '#e74c3c',
    textAlign: 'center'
  },
  nextBadge: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    fontSize: 9,
    color: '#f1c40f',
    textAlign: 'center'
  },
  unknownCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1.5px dashed #444',
    borderRadius: 6,
    minHeight: 54,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  nextHint: {
    marginTop: 6,
    fontSize: 11,
    color: '#ccc',
    textAlign: 'center',
    padding: '4px 0',
    borderTop: '1px solid rgba(255,255,255,0.08)'
  }
}

import React, { useEffect, useState } from 'react'
import { DeckPanel } from './components/DeckPanel'
import { ElixirBar } from './components/ElixirBar'
import { getMockState } from './mock'
import type { OverlayState } from '../recognition/RecognitionLoop'

// URL 里带 ?mock 参数就进入 Mock 模式，如：http://localhost:5173/?mock
const IS_MOCK = new URLSearchParams(window.location.search).has('mock')

const EMPTY_STATE: OverlayState = {
  deck: { knownCards: [], unknownSlots: 8, cyclePosition: 0, confidence: 0 },
  elixir: { estimated: 5, visual: null, isDoubleElixir: false, ratePerSec: 1 / 2.8 },
  fps: 0,
  lastUpdated: 0
}

export function OverlayApp(): React.ReactElement {
  const [state, setState] = useState<OverlayState>(EMPTY_STATE)
  const [active, setActive] = useState(IS_MOCK)

  useEffect(() => {
    if (IS_MOCK) {
      // Mock 模式：每 800ms 推一帧假数据
      const timer = setInterval(() => setState(getMockState()), 800)
      return () => clearInterval(timer)
    }

    // 真实模式：监听来自主进程的状态更新
    if (!window.crTracker) return
    const unsub = window.crTracker.onStateUpdate((s) => {
      setState(s)
      setActive(true)
    })
    return unsub
  }, [])

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.title}>CR Tracker</span>
        <span style={styles.badge}>
          {IS_MOCK
            ? <span style={styles.mockBadge}>MOCK</span>
            : <span style={{ color: '#888' }}>{active ? `${state.fps} fps` : '未连接'}</span>
          }
        </span>
      </div>

      <DeckPanel deck={state.deck} />
      <ElixirBar elixir={state.elixir} />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: 300,
    background: 'rgba(10, 10, 20, 0.82)',
    borderRadius: 12,
    padding: '10px 12px',
    color: '#f0f0f0',
    fontSize: 13,
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    userSelect: 'none'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  title: {
    fontWeight: 700,
    fontSize: 14,
    color: '#c9a84c',
    letterSpacing: 1
  },
  badge: { fontSize: 11 },
  mockBadge: {
    background: '#f59e0b',
    color: '#000',
    padding: '1px 5px',
    borderRadius: 4,
    fontWeight: 700,
    fontSize: 10
  }
}

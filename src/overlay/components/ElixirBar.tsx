/**
 * ElixirBar.tsx
 * 圣水条可视化
 *
 * 显示：
 *  - 进度条（0–10 格，每格 1 点）
 *  - 当前估算数值
 *  - 双倍圣水指示
 */

import React from 'react'
import type { ElixirState } from '../../tracker/ElixirTracker'

interface Props {
  elixir: ElixirState
}

export function ElixirBar({ elixir }: Props): React.ReactElement {
  const { estimated, isDoubleElixir } = elixir
  const filled = Math.round(estimated)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>
          {isDoubleElixir ? '⚡ 双倍圣水' : '圣水'}
        </span>
        <span style={styles.value}>{estimated.toFixed(1)}</span>
      </div>

      {/* 10 格进度条 */}
      <div style={styles.bar}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.cell,
              background: i < filled
                ? (isDoubleElixir ? '#c084fc' : '#818cf8')
                : 'rgba(255,255,255,0.08)'
            }}
          />
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.08)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  label: {
    fontSize: 11,
    color: '#aaa'
  },
  value: {
    fontSize: 13,
    fontWeight: 700,
    color: '#818cf8'
  },
  bar: {
    display: 'flex',
    gap: 2
  },
  cell: {
    flex: 1,
    height: 12,
    borderRadius: 3,
    transition: 'background 0.2s'
  }
}

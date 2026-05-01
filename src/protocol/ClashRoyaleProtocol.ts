/**
 * ClashRoyaleProtocol.ts
 * 游戏 UI 坐标协议表
 *
 * 坐标系：以模拟器游戏窗口左上角为原点（像素）。
 * 基准分辨率：450 × 800（竖屏）
 *
 * 所有坐标函数在调用时动态计算，
 * 确保 setScale() 之后立即生效，不会越界。
 */

import type { Rect } from '../capture/ScreenCapture'

// ── 基准分辨率 ────────────────────────────────────────────────────────────────

export const BASE_W = 450
export const BASE_H = 800

export let SCALE_X = 1.0
export let SCALE_Y = 1.0

export function setScale(w: number, h: number): void {
  SCALE_X = w / BASE_W
  SCALE_Y = h / BASE_H
}

function s(r: Rect): Rect {
  return {
    x: Math.round(r.x * SCALE_X),
    y: Math.round(r.y * SCALE_Y),
    w: Math.round(r.w * SCALE_X),
    h: Math.round(r.h * SCALE_Y)
  }
}

// ── 模板尺寸 ──────────────────────────────────────────────────────────────────

export const TEMPLATE_SIZE = { w: 48, h: 64 }

// ── 圣水条颜色范围 ────────────────────────────────────────────────────────────

export const ELIXIR_COLOR = {
  hMin: 190, hMax: 240,
  sMin: 60,
  vMin: 80
}

// ── 动态坐标函数（每次调用时按当前 SCALE 计算）────────────────────────────────

export function ARENA_OPPONENT_HALF(): Rect {
  return s({ x: 0, y: 80, w: 450, h: 270 })
}

export function ELIXIR_BAR(): Rect {
  return s({ x: 10, y: 760, w: 430, h: 14 })
}

export function TIMER_REGION(): Rect {
  return s({ x: 175, y: 32, w: 100, h: 36 })
}

export function OWN_HAND_CARDS(): Rect[] {
  return [
    s({ x: 30,  y: 670, w: 80, h: 80 }),
    s({ x: 130, y: 670, w: 80, h: 80 }),
    s({ x: 230, y: 670, w: 80, h: 80 }),
    s({ x: 330, y: 670, w: 80, h: 80 }),
  ]
}

export function getDetectionCells(): Rect[] {
  const base = ARENA_OPPONENT_HALF()
  const cols = 3, rows = 4
  const cellW = Math.round(base.w / cols)
  const cellH = Math.round(base.h / rows)
  const cells: Rect[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        x: base.x + col * cellW,
        y: base.y + row * cellH,
        w: cellW,
        h: cellH
      })
    }
  }
  return cells
}

// ── 卡牌元数据表 ──────────────────────────────────────────────────────────────

export interface CardMeta {
  id: string
  displayName: string
  elixirCost: number
  type: 'troop' | 'spell' | 'building'
}

export const CARD_REGISTRY: Record<string, CardMeta> = {
  fireball:      { id: 'fireball',      displayName: '火球',    elixirCost: 4, type: 'spell'    },
  lightning:     { id: 'lightning',     displayName: '闪电',    elixirCost: 6, type: 'spell'    },
  arrows:        { id: 'arrows',        displayName: '箭雨',    elixirCost: 3, type: 'spell'    },
  zap:           { id: 'zap',           displayName: '电击',    elixirCost: 2, type: 'spell'    },
  giant:         { id: 'giant',         displayName: '巨人',    elixirCost: 5, type: 'troop'    },
  pekka:         { id: 'pekka',         displayName: 'PEKKA',   elixirCost: 7, type: 'troop'    },
  prince:        { id: 'prince',        displayName: '王子',    elixirCost: 5, type: 'troop'    },
  musketeer:     { id: 'musketeer',     displayName: '火枪手',  elixirCost: 4, type: 'troop'    },
  valkyrie:      { id: 'valkyrie',      displayName: '女武神',  elixirCost: 4, type: 'troop'    },
  minions:       { id: 'minions',       displayName: '亡灵军团', elixirCost: 3, type: 'troop'   },
  hog_rider:     { id: 'hog_rider',     displayName: '野猪骑士', elixirCost: 4, type: 'troop'  },
  goblin_barrel: { id: 'goblin_barrel', displayName: '哥布林桶', elixirCost: 3, type: 'spell'  },
  cannon:        { id: 'cannon',        displayName: '炸弹塔',  elixirCost: 3, type: 'building' },
  inferno_tower: { id: 'inferno_tower', displayName: '地狱塔',  elixirCost: 5, type: 'building' },
  x_bow:         { id: 'x_bow',         displayName: 'X弓',     elixirCost: 6, type: 'building' },
}

/**
 * ClashRoyaleProtocol.ts
 * 游戏 UI 坐标协议表
 *
 * 把所有"游戏画面里哪个像素是什么"集中到这里，
 * 其余模块只引用名称，不硬编码坐标。
 *
 * 坐标系：以模拟器游戏窗口左上角为原点（像素）。
 * 默认基准分辨率：450 × 800（竖屏，BlueStacks 默认缩放）
 * 如果你的模拟器分辨率不同，只需修改 SCALE_X / SCALE_Y。
 *
 * 校准流程：
 *  1. DEBUG_SAVE=true yarn dev 截一张全屏
 *  2. 用 GIMP / Photoshop 量取各区域像素坐标
 *  3. 更新下方常量，重启即可
 */

import type { Rect } from '../capture/ScreenCapture'

// ── 基准分辨率 ────────────────────────────────────────────────────────────────

export const BASE_W = 450
export const BASE_H = 800

// 如果实际游戏窗口不是 450×800，在这里填入实际尺寸，
// scale() 会自动换算所有坐标
export let SCALE_X = 1.0
export let SCALE_Y = 1.0

export function setScale(w: number, h: number): void {
  SCALE_X = w / BASE_W
  SCALE_Y = h / BASE_H
}

function scale(r: Rect): Rect {
  return {
    x: Math.round(r.x * SCALE_X),
    y: Math.round(r.y * SCALE_Y),
    w: Math.round(r.w * SCALE_X),
    h: Math.round(r.h * SCALE_Y)
  }
}

// ── 模板尺寸（统一缩放目标，节省 NCC 计算量） ───────────────────────────────

export const TEMPLATE_SIZE = { w: 48, h: 64 }

// ── 竞技场区域 ────────────────────────────────────────────────────────────────

/**
 * line 70 ↓  各命名区域定义
 *
 * 竞技场被分为上半（对方）/ 下半（己方），
 * 出牌检测只扫 ARENA_OPPONENT_HALF（节省计算）
 */
export const ARENA_FULL: Rect       = scale({ x: 0,   y: 80,  w: 450, h: 540 })
export const ARENA_OPPONENT_HALF: Rect = scale({ x: 0, y: 80,  w: 450, h: 270 })
export const ARENA_OWN_HALF: Rect   = scale({ x: 0,   y: 350, w: 450, h: 270 })

// ── 己方手牌区域（4 张 + 即将出现的下一张）────────────────────────────────────

/**
 * 手牌在游戏底部水平排列。
 * 坐标为每张牌的图标区域（不含费用数字）。
 */
export const OWN_HAND_CARDS: Rect[] = [
  scale({ x: 30,  y: 670, w: 80, h: 80 }), // 第 1 张
  scale({ x: 130, y: 670, w: 80, h: 80 }), // 第 2 张
  scale({ x: 230, y: 670, w: 80, h: 80 }), // 第 3 张
  scale({ x: 330, y: 670, w: 80, h: 80 }), // 第 4 张
]

export const OWN_NEXT_CARD: Rect = scale({ x: 375, y: 710, w: 60, h: 60 })

// ── 圣水条 ────────────────────────────────────────────────────────────────────

/**
 * 圣水条是游戏底部的蓝色进度条。
 * 通过扫描蓝色像素的宽度可估算当前圣水值（0–10）。
 */
export const ELIXIR_BAR: Rect = scale({ x: 10, y: 760, w: 430, h: 14 })

// 圣水条蓝色像素的 HSV 范围（用于颜色过滤）
export const ELIXIR_COLOR = {
  hMin: 190, hMax: 240,  // 蓝紫色调
  sMin: 60,              // 饱和度下限，过滤灰色 UI
  vMin: 80               // 亮度下限
}

// ── 计时器区域 ────────────────────────────────────────────────────────────────

export const TIMER_REGION: Rect = scale({ x: 175, y: 32, w: 100, h: 36 })

// ── 对方出牌检测格子（滑动窗口扫描目标区域）────────────────────────────────────

/**
 * 把对方半场分成 N×M 个格子，每帧对每个格子做模板匹配。
 * 格子越密，漏检越少，但 CPU 消耗线性增加。
 * MVP 建议 3×4 = 12 个格子。
 */
export const DETECTION_GRID = {
  cols: 3,
  rows: 4,
  cellW: Math.round(450 / 3),
  cellH: Math.round(270 / 4)
}

export function getDetectionCells(): Rect[] {
  const cells: Rect[] = []
  const base = ARENA_OPPONENT_HALF
  for (let row = 0; row < DETECTION_GRID.rows; row++) {
    for (let col = 0; col < DETECTION_GRID.cols; col++) {
      cells.push(
        scale({
          x: base.x + col * DETECTION_GRID.cellW,
          y: base.y + row * DETECTION_GRID.cellH,
          w: DETECTION_GRID.cellW,
          h: DETECTION_GRID.cellH
        })
      )
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

/**
 * 常见卡牌元数据（精简版，可按需扩充）。
 * id 与 assets/templates/<id>.png 文件名对应。
 */
export const CARD_REGISTRY: Record<string, CardMeta> = {
  fireball:        { id: 'fireball',        displayName: '火球',    elixirCost: 4, type: 'spell'    },
  lightning:       { id: 'lightning',       displayName: '闪电',    elixirCost: 6, type: 'spell'    },
  arrows:          { id: 'arrows',          displayName: '箭雨',    elixirCost: 3, type: 'spell'    },
  zap:             { id: 'zap',             displayName: '电击',    elixirCost: 2, type: 'spell'    },
  giant:           { id: 'giant',           displayName: '巨人',    elixirCost: 5, type: 'troop'    },
  pekka:           { id: 'pekka',           displayName: 'PEKKA',   elixirCost: 7, type: 'troop'    },
  prince:          { id: 'prince',          displayName: '王子',    elixirCost: 5, type: 'troop'    },
  musketeer:       { id: 'musketeer',       displayName: '火枪手',  elixirCost: 4, type: 'troop'    },
  valkyrie:        { id: 'valkyrie',        displayName: '女武神',  elixirCost: 4, type: 'troop'    },
  minions:         { id: 'minions',         displayName: '亡灵军团', elixirCost: 3, type: 'troop'   },
  hog_rider:       { id: 'hog_rider',       displayName: '野猪骑士', elixirCost: 4, type: 'troop'  },
  goblin_barrel:   { id: 'goblin_barrel',   displayName: '哥布林桶', elixirCost: 3, type: 'spell'  },
  cannon:          { id: 'cannon',          displayName: '炸弹塔',  elixirCost: 3, type: 'building' },
  inferno_tower:   { id: 'inferno_tower',   displayName: '地狱塔',  elixirCost: 5, type: 'building' },
  x_bow:           { id: 'x_bow',           displayName: 'X弓',     elixirCost: 6, type: 'building' },
}

# 坐标校准指南

## 步骤

1. 启动模拟器（推荐 BlueStacks，竖屏 450×800）
2. 进入皇室战争，停在主菜单

3. 运行调试模式（见下方命令），  
   截图会存到 `C:\Users\<你的用户名>\cr_debug\game_full_<timestamp>.png`

4. 用 GIMP 打开截图：  
   - 鼠标移到区域边界，底部状态栏显示像素坐标  
   - 记录下各区域的 `x, y, w, h`

5. 更新 `src/protocol/ClashRoyaleProtocol.ts` 中对应的常量：  
   - `OWN_HAND_CARDS`：己方 4 张手牌  
   - `ELIXIR_BAR`：圣水条  
   - `TIMER_REGION`：计时器  
   - `ARENA_OPPONENT_HALF`：对方半场  

6. 如果你的模拟器窗口不是 450×800，在代码启动时调用：  
   ```ts
   import { setScale } from './protocol/ClashRoyaleProtocol'
   setScale(actualWidth, actualHeight)
   ```

## 常见模拟器分辨率

| 模拟器       | 默认游戏区尺寸 |
|-------------|--------------|
| BlueStacks 5 | 450×800      |
| MuMu Player  | 540×960      |
| LDPlayer     | 450×800      |
| Nox          | 360×640      |

## 圣水条颜色调整

如果圣水读数偏差大，可能是主题皮肤改变了颜色。  
在 `ClashRoyaleProtocol.ts` 调整 `ELIXIR_COLOR` 的 H/S/V 范围，  
用 GIMP 的颜色选取器测量实际颜色的 HSV 值。

# 卡牌模板图说明

每张卡牌需要一个 PNG 模板文件，命名格式：`<cardId>.png`

文件名必须与 `ClashRoyaleProtocol.ts` 中 `CARD_REGISTRY` 的 key 一致。
例如：`fireball.png`、`giant.png`、`hog_rider.png`

## 如何采集模板

### 方案 A：直接拉网上卡牌素材

脚本会从 Liquipedia Commons 的卡牌文件页读取原图链接，保存原始图到
`assets/source-cards/`，再生成 `48×64` 灰度模板到本目录。

```bash
npm run template:fetch -- fireball giant hog_rider
```

拉取脚本内置的全部卡牌：

```bash
npm run template:fetch -- --all
```

查看当前支持的 id：

```bash
npm run template:fetch -- --list
```

注意：这些卡牌素材页面标注为 Supercell 媒体，建议只用于本地学习/识别测试，
不要把素材文件二次发布。

### 方案 B：从游戏截图裁剪

1. 开启 `DEBUG_SAVE=true yarn dev`
2. 在游戏中让每张卡出现在固定位置（如手牌区域）
3. 截图保存到 `/tmp/cr_debug/`
4. 用图片查看器/GIMP 量出卡牌图标区域坐标 `x,y,w,h`
5. 用脚本裁剪并保存到本目录：
   ```bash
   yarn template:crop fireball --rect 184,666,80,80
   ```

脚本默认读取 `/tmp/cr_debug/` 里最新的 `game_full_*.png`，输出
`assets/templates/<cardId>.png`，并自动转成 48×64 灰度 PNG。

也可以显式指定截图：

```bash
yarn template:crop hog_rider /tmp/cr_debug/game_full_123.png 130 670 80 80
```

批量裁剪：

```json
[
  { "id": "fireball", "rect": [184, 666, 80, 80] },
  { "id": "giant", "rect": [130, 670, 80, 80] }
]
```

```bash
yarn template:crop --batch crops.json
```

## 尺寸要求

- 宽：48 px，高：64 px（与 `TEMPLATE_SIZE` 一致）
- 格式：PNG，灰度图（彩色也可以，TemplateMatcher 会自动转灰度）
- 内容：卡牌图标，不含费用数字，不含边框光效

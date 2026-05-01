/**
 * calibrate.cjs
 * 自动检测屏幕分辨率 + 引导用户填入游戏窗口坐标
 */

const { execSync } = require('child_process')
const s = require('screenshot-desktop')
const fs = require('fs')

async function main() {
  // 获取屏幕分辨率
  const screens = await s.listDisplays()
  console.log('\n=== 屏幕信息 ===')
  screens.forEach((sc, i) => {
    console.log(`屏幕 ${i}: ${JSON.stringify(sc)}`)
  })

  // 截图保存
  console.log('\n3秒后截图，请切换到游戏画面...')
  await new Promise(r => setTimeout(r, 3000))
  const buf = await s()
  fs.writeFileSync('screen_calibrate.png', buf)
  console.log('截图保存到 screen_calibrate.png')

  console.log(`
=== 接下来的步骤 ===
1. 打开 screen_calibrate.png
2. 用画图工具（Win+R → mspaint）打开它
3. 把鼠标移到游戏画面的【左上角】，记下底部状态栏的坐标 (x, y)
4. 把鼠标移到游戏画面的【右下角】，记下坐标，计算宽高
5. 把4个数字发给 Claude
`)
}

main().catch(console.error)

/**
 * test-window.cjs
 * 列出所有可见窗口标题，找到模拟器的精确窗口名
 */

const { execSync } = require('child_process')

const ps = `
Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object MainWindowTitle | ForEach-Object { $_.MainWindowTitle }
`

try {
  const result = execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`, {
    timeout: 5000,
    windowsHide: true
  }).toString().trim()

  console.log('=== 当前所有可见窗口标题 ===')
  result.split('\n').forEach(line => {
    const t = line.trim()
    if (t) console.log(' -', t)
  })
  console.log('\n把包含"MuMu"或"模拟器"的那一行发给 Claude')
} catch (e) {
  console.error('执行失败:', e.message)
}

const s = require('screenshot-desktop')
const fs = require('fs')

s().then(buf => {
  fs.writeFileSync('screen.png', buf)
  console.log('截图已保存到 screen.png')
}).catch(err => {
  console.error('截图失败:', err.message)
})

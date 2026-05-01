const { execSync } = require('child_process')

const ps = `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
}
public struct RECT { public int Left,Top,Right,Bottom; }
"@
$procs = Get-Process | Where-Object { $_.Name -like '*MuMu*' -and $_.MainWindowHandle -ne 0 }
foreach ($p in $procs) {
  $r = New-Object RECT
  if ([Win32]::GetWindowRect($p.MainWindowHandle, [ref]$r)) {
    $w = $r.Right - $r.Left
    $h = $r.Bottom - $r.Top
    Write-Output "进程: $($p.Name) | 坐标: left=$($r.Left) top=$($r.Top) w=$w h=$h"
  }
}
`

try {
  const result = execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`, {
    timeout: 5000,
    windowsHide: true
  }).toString().trim()

  if (result) {
    console.log('找到 MuMu 窗口：')
    console.log(result)
  } else {
    console.log('未找到 MuMu 窗口，请确认模拟器正在运行')
  }
} catch(e) {
  console.error('失败:', e.message)
}

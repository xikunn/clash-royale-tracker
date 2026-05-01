/// <reference types="electron" />

import type { EmulatorWindow } from '../capture/ScreenCapture'
import type { OverlayState } from '../recognition/RecognitionLoop'

declare global {
  interface Window {
    crTracker: {
      startLoop: (win: EmulatorWindow) => Promise<{ ok: boolean }>
      stopLoop: () => Promise<{ ok: boolean }>
      setClickThrough: (enable: boolean) => Promise<{ ok: boolean }>
      moveOverlay: (x: number, y: number) => Promise<{ ok: boolean }>
      setThreshold: (t: number) => Promise<{ ok: boolean }>
      listScreens: () => Promise<Array<{ id: number; label: string; bounds: Electron.Rectangle }>>
      onStateUpdate: (cb: (state: OverlayState) => void) => () => void
    }
  }
}

declare module 'screenshot-desktop' {
  interface Display {
    id: string | number
    name: string
  }
  function screenshot(options?: { screen?: string | number; format?: string }): Promise<Buffer>
  namespace screenshot {
    function listDisplays(): Promise<Display[]>
  }
  export = screenshot
}

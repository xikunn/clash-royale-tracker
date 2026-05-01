#!/usr/bin/env node

/**
 * Crop a Clash Royale card template from a debug screenshot.
 *
 * Output format:
 * - 48x64 PNG
 * - grayscale + normalized
 * - saved as assets/templates/<cardId>.png by default
 */

const fs = require('fs')
const path = require('path')
const Jimp = require('jimp')

const ROOT = path.resolve(__dirname, '..')
const DEBUG_DIR = '/tmp/cr_debug'
const DEFAULT_OUT_DIR = path.join(ROOT, 'assets/templates')
const DEFAULT_SIZE = { w: 48, h: 64 }

function usage(exitCode = 0) {
  const text = `
Usage:
  yarn template:crop <cardId> --rect x,y,w,h [--image latest]
  yarn template:crop <cardId> <image> <x> <y> <w> <h>
  yarn template:crop --batch crops.json

Examples:
  yarn template:crop fireball --rect 184,666,80,80
  yarn template:crop hog_rider /tmp/cr_debug/game_full_123.png 130 670 80 80

Batch JSON:
  [
    { "id": "fireball", "rect": [184, 666, 80, 80] },
    { "id": "giant", "image": "/tmp/cr_debug/game_full_123.png", "rect": [130, 670, 80, 80] }
  ]

Options:
  --image <path|latest>     Source screenshot. Defaults to latest /tmp/cr_debug/game_full_*.png
  --rect <x,y,w,h>          Crop rectangle in screenshot pixels
  --out-dir <dir>           Output directory. Defaults to assets/templates
  --size <w>x<h>            Output size. Defaults to 48x64
  --batch <file>            Crop many templates from a JSON manifest
`
  console.log(text.trim())
  process.exit(exitCode)
}

function parseArgs(argv) {
  const opts = {
    image: 'latest',
    outDir: DEFAULT_OUT_DIR,
    size: DEFAULT_SIZE
  }
  const positional = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--help':
      case '-h':
        usage(0)
        break
      case '--image':
        opts.image = requireValue(argv, ++i, '--image')
        break
      case '--rect':
        opts.rect = parseRect(requireValue(argv, ++i, '--rect'))
        break
      case '--out-dir':
        opts.outDir = path.resolve(requireValue(argv, ++i, '--out-dir'))
        break
      case '--size':
        opts.size = parseSize(requireValue(argv, ++i, '--size'))
        break
      case '--batch':
        opts.batch = path.resolve(requireValue(argv, ++i, '--batch'))
        break
      default:
        positional.push(arg)
        break
    }
  }

  if (opts.batch) return opts

  if (positional.length === 6) {
    opts.cardId = positional[0]
    opts.image = positional[1]
    opts.rect = parseRect(positional.slice(2).join(','))
    return opts
  }

  if (positional.length === 1 && opts.rect) {
    opts.cardId = positional[0]
    return opts
  }

  usage(1)
}

function requireValue(argv, index, flag) {
  const value = argv[index]
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

function parseRect(value) {
  const parts = String(value).split(',').map((n) => Number(n.trim()))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid rect "${value}". Expected x,y,w,h`)
  }
  const [x, y, w, h] = parts.map(Math.round)
  if (w <= 0 || h <= 0) {
    throw new Error(`Invalid rect "${value}". Width and height must be positive`)
  }
  return { x, y, w, h }
}

function parseSize(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/i)
  if (!match) throw new Error(`Invalid size "${value}". Expected 48x64`)
  return { w: Number(match[1]), h: Number(match[2]) }
}

function latestDebugScreenshot() {
  if (!fs.existsSync(DEBUG_DIR)) {
    throw new Error(`${DEBUG_DIR} does not exist. Run DEBUG_SAVE=true yarn dev first.`)
  }

  const files = fs.readdirSync(DEBUG_DIR)
    .filter((file) => /^game_full_.*\.png$/.test(file))
    .map((file) => path.join(DEBUG_DIR, file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)

  if (files.length === 0) {
    throw new Error(`No game_full_*.png screenshots found in ${DEBUG_DIR}`)
  }

  return files[0]
}

function resolveImage(image) {
  if (!image || image === 'latest') return latestDebugScreenshot()
  return path.resolve(image)
}

function assertCardId(id) {
  if (!/^[a-z0-9_]+$/.test(id)) {
    throw new Error(`Invalid cardId "${id}". Use lowercase ids like fireball or hog_rider.`)
  }
}

async function cropOne({ cardId, image, rect, outDir, size }) {
  assertCardId(cardId)

  const imagePath = resolveImage(image)
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Source image not found: ${imagePath}`)
  }

  fs.mkdirSync(outDir, { recursive: true })

  const source = await Jimp.read(imagePath)
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > source.bitmap.width || rect.y + rect.h > source.bitmap.height) {
    throw new Error(
      `Rect ${rect.x},${rect.y},${rect.w},${rect.h} is outside image ${source.bitmap.width}x${source.bitmap.height}`
    )
  }

  const output = source
    .clone()
    .crop(rect.x, rect.y, rect.w, rect.h)
    .grayscale()
    .normalize()
    .resize(size.w, size.h, Jimp.RESIZE_BILINEAR)

  const outPath = path.join(outDir, `${cardId}.png`)
  await output.writeAsync(outPath)

  console.log(`[template] ${cardId} <- ${imagePath} @ ${rect.x},${rect.y},${rect.w},${rect.h}`)
  console.log(`[template] wrote ${outPath} (${size.w}x${size.h}, grayscale PNG)`)
}

async function runBatch(opts) {
  const manifestPath = opts.batch
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (!Array.isArray(manifest)) {
    throw new Error('Batch manifest must be an array')
  }

  for (const item of manifest) {
    if (!item.id || !item.rect) {
      throw new Error(`Invalid batch item: ${JSON.stringify(item)}`)
    }
    const rect = Array.isArray(item.rect) ? parseRect(item.rect.join(',')) : parseRect(item.rect)
    await cropOne({
      cardId: item.id,
      image: item.image ?? opts.image,
      rect,
      outDir: opts.outDir,
      size: opts.size
    })
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.batch) {
    await runBatch(opts)
    return
  }
  await cropOne({
    cardId: opts.cardId,
    image: opts.image,
    rect: opts.rect,
    outDir: opts.outDir,
    size: opts.size
  })
}

main().catch((error) => {
  console.error(`[template] ${error.message}`)
  process.exit(1)
})

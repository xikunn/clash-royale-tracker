#!/usr/bin/env node

/**
 * Fetch Clash Royale card images from Liquipedia Commons and convert them into
 * local 48x64 grayscale recognition templates.
 *
 * The images are Supercell media. Keep them for local research/testing unless
 * you have the rights needed for redistribution.
 */

const fs = require('fs')
const https = require('https')
const path = require('path')
const Jimp = require('jimp')

const ROOT = path.resolve(__dirname, '..')
const DEFAULT_OUT_DIR = path.join(ROOT, 'assets/templates')
const DEFAULT_RAW_DIR = path.join(ROOT, 'assets/source-cards')
const DEFAULT_SIZE = { w: 48, h: 64 }

const CARD_PAGES = {
  fireball: 'Clash Royale Card Fireball.png',
  lightning: 'Clash Royale Card Lightning.png',
  arrows: 'Clash Royale Card Arrows.png',
  zap: 'Clash Royale Card Zap.png',
  giant: 'Clash Royale Card Giant.png',
  pekka: 'Clash Royale Card P.E.K.K.A..png',
  prince: 'Clash Royale Card Prince.png',
  musketeer: 'Clash Royale Card Musketeer.png',
  valkyrie: 'Clash Royale Card Valkyrie.png',
  minions: 'Clash Royale Card Minions.png',
  hog_rider: 'Clash Royale Card Hog Rider.png',
  goblin_barrel: 'Clash Royale Card Goblin Barrel.png',
  cannon: 'Clash Royale Card Cannon.png',
  inferno_tower: 'Clash Royale Card Inferno Tower.png',
  x_bow: 'Clash Royale Card X-Bow.png'
}

function usage(exitCode = 0) {
  const text = `
Usage:
  npm run template:fetch -- --all
  npm run template:fetch -- fireball giant hog_rider

Options:
  --all                 Fetch every card id known to this script
  --out-dir <dir>       Output template directory. Defaults to assets/templates
  --raw-dir <dir>       Raw source image directory. Defaults to assets/source-cards
  --size <w>x<h>        Output template size. Defaults to 48x64
  --list                List supported card ids
`
  console.log(text.trim())
  process.exit(exitCode)
}

function parseArgs(argv) {
  const opts = {
    ids: [],
    outDir: DEFAULT_OUT_DIR,
    rawDir: DEFAULT_RAW_DIR,
    size: DEFAULT_SIZE,
    all: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--help':
      case '-h':
        usage(0)
        break
      case '--all':
        opts.all = true
        break
      case '--list':
        console.log(Object.keys(CARD_PAGES).join('\n'))
        process.exit(0)
        break
      case '--out-dir':
        opts.outDir = path.resolve(requireValue(argv, ++i, '--out-dir'))
        break
      case '--raw-dir':
        opts.rawDir = path.resolve(requireValue(argv, ++i, '--raw-dir'))
        break
      case '--size':
        opts.size = parseSize(requireValue(argv, ++i, '--size'))
        break
      default:
        opts.ids.push(arg)
        break
    }
  }

  if (opts.all) opts.ids = Object.keys(CARD_PAGES)
  if (opts.ids.length === 0) usage(1)
  return opts
}

function requireValue(argv, index, flag) {
  const value = argv[index]
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`)
  return value
}

function parseSize(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/i)
  if (!match) throw new Error(`Invalid size "${value}". Expected 48x64`)
  return { w: Number(match[1]), h: Number(match[2]) }
}

function filePageUrl(fileName) {
  return `https://liquipedia.net/commons/File:${encodeURIComponent(fileName).replace(/%20/g, '_')}`
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'clash-royale-tracker-template-fetcher/0.1 (+local research)'
      }
    }, (res) => {
      const status = res.statusCode ?? 0
      const location = res.headers.location
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        res.resume()
        if (redirects > 5) {
          reject(new Error(`Too many redirects while fetching ${url}`))
          return
        }
        const nextUrl = new URL(location, url).toString()
        fetchBuffer(nextUrl, redirects + 1).then(resolve, reject)
        return
      }

      if (status < 200 || status >= 300) {
        res.resume()
        reject(new Error(`HTTP ${status} for ${url}`))
        return
      }

      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy(new Error(`Timed out fetching ${url}`))
    })
  })
}

function extractImageUrl(html, fileName) {
  const escaped = escapeRegExp(fileName.replace(/ /g, '_'))
  const direct = new RegExp(`https://liquipedia\\.net/commons/images/[^"'<>)\\s]+/${escaped}`, 'i')
  const directMatch = html.match(direct)
  if (directMatch) return directMatch[0]

  const href = new RegExp(`href="(/commons/images/[^"]+/${escaped})"`, 'i')
  const hrefMatch = html.match(href)
  if (hrefMatch) return `https://liquipedia.net${hrefMatch[1]}`

  throw new Error(`Could not find source image URL for ${fileName}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function fetchOne(id, opts) {
  const fileName = CARD_PAGES[id]
  if (!fileName) {
    throw new Error(`Unknown card id "${id}". Run --list to see supported ids.`)
  }

  const pageUrl = filePageUrl(fileName)
  const html = (await fetchBuffer(pageUrl)).toString('utf8')
  const imageUrl = extractImageUrl(html, fileName)
  const raw = await fetchBuffer(imageUrl)

  fs.mkdirSync(opts.rawDir, { recursive: true })
  fs.mkdirSync(opts.outDir, { recursive: true })

  const rawPath = path.join(opts.rawDir, `${id}.png`)
  fs.writeFileSync(rawPath, raw)

  const img = await Jimp.read(raw)
  img
    .contain(opts.size.w, opts.size.h, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
    .grayscale()
    .normalize()

  const outPath = path.join(opts.outDir, `${id}.png`)
  await img.writeAsync(outPath)

  console.log(`[template] ${id}`)
  console.log(`  source: ${imageUrl}`)
  console.log(`  raw:    ${rawPath}`)
  console.log(`  out:    ${outPath} (${opts.size.w}x${opts.size.h}, grayscale PNG)`)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const failed = []

  for (const id of opts.ids) {
    try {
      await fetchOne(id, opts)
    } catch (error) {
      failed.push({ id, message: error.message })
      console.error(`[template] ${id}: ${error.message}`)
    }
  }

  if (failed.length > 0) {
    console.error(`\nFailed ${failed.length}/${opts.ids.length}:`)
    for (const failure of failed) {
      console.error(`- ${failure.id}: ${failure.message}`)
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`[template] ${error.message}`)
  process.exit(1)
})

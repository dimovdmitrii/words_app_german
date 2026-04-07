/**
 * Builds Android mipmap PNGs from a source image (PNG or SVG).
 * Run: npm run icons:android
 *
 * Source file:
 *   public/favicon.png
 */
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const androidRes = join(root, 'android/app/src/main/res')

const SOURCE_PATH = join(publicDir, 'favicon.png')

/** Legacy launcher background if source has transparent edges */
const pad = { r: 255, g: 255, b: 255, alpha: 1 }

const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
const adaptiveFg = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }

/** Сильное DEFLATE-сжатие — без этого 15 PNG в mipmap легко дают +3–6 МБ к APK/AAB */
const pngOut = {
  compressionLevel: 9,
  adaptiveFiltering: true,
  effort: 10
}

async function renderIcon(sourcePath, size, outFile, transparentBg) {
  const bg = transparentBg ? { r: 0, g: 0, b: 0, alpha: 0 } : pad
  await sharp(sourcePath)
    .resize(size, size, { fit: 'contain', background: bg })
    .png(pngOut)
    .toFile(outFile)
}

if (!existsSync(SOURCE_PATH)) {
  console.error(
    'Icon source file is missing: public/favicon.png'
  )
  process.exit(1)
}

console.log('Source:', SOURCE_PATH)

for (const [name, size] of Object.entries(legacy)) {
  const dir = join(androidRes, `mipmap-${name}`)
  mkdirSync(dir, { recursive: true })
  await renderIcon(SOURCE_PATH, size, join(dir, 'ic_launcher.png'), false)
  await renderIcon(SOURCE_PATH, size, join(dir, 'ic_launcher_round.png'), false)
  console.log(`wrote mipmap-${name} ic_launcher (+ round) ${size}px`)
}

for (const [name, size] of Object.entries(adaptiveFg)) {
  const dir = join(androidRes, `mipmap-${name}`)
  mkdirSync(dir, { recursive: true })
  await renderIcon(SOURCE_PATH, size, join(dir, 'ic_launcher_foreground.png'), true)
  console.log(`wrote mipmap-${name} ic_launcher_foreground ${size}px`)
}

console.log('Done.')

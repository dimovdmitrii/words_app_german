/**
 * Increments versionCode and versionName in android/app/build.gradle.
 * Skip: SKIP_ANDROID_BUMP=1 npm run build:android
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.env.SKIP_ANDROID_BUMP === '1') {
  console.log('bump-android-version: skipped (SKIP_ANDROID_BUMP=1)')
  process.exit(0)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const gradlePath = join(__dirname, '../android/app/build.gradle')

let text = readFileSync(gradlePath, 'utf8')

const codeMatch = text.match(/versionCode\s+(\d+)/)
const nameMatch = text.match(/versionName\s+"([^"]*)"/)
if (!codeMatch || !nameMatch) {
  console.error('bump-android-version: could not find versionCode / versionName in android/app/build.gradle')
  process.exit(1)
}

const prevCode = Number(codeMatch[1])
const nextCode = prevCode + 1

const currentName = nameMatch[1]

/** @returns {string} */
function bumpSemverPatch(v) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/)
  if (m) {
    const patch = Number(m[3]) + 1
    return `${m[1]}.${m[2]}.${patch}${m[4]}`
  }
  const m2 = v.match(/^(\d+)\.(\d+)$/)
  if (m2) {
    return `${m2[1]}.${Number(m2[2]) + 1}.0`
  }
  console.warn(`bump-android-version: versionName "${v}" not x.y.z — only versionCode bumped`)
  return v
}

const nextName = bumpSemverPatch(currentName)

text = text.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`)
text = text.replace(/versionName\s+"[^"]*"/, `versionName "${nextName}"`)

writeFileSync(gradlePath, text, 'utf8')
console.log(`bump-android-version: ${prevCode} → ${nextCode} (${currentName} → ${nextName})`)

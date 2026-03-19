const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const ALLOWED_LEVELS = new Set(['A1-A2', 'B1-B2', 'C1-C2'])

function normalize(text) {
  return String(text || '').trim().toLowerCase()
}

function extractJSONArray(rawText) {
  const trimmed = rawText.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced ? fenced[1].trim() : trimmed
  const start = source.indexOf('[')
  const end = source.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(source.slice(start, end + 1))
  } catch {
    return null
  }
}

function extractRetryAfterSec(message) {
  if (typeof message !== 'string') return null
  const match = message.match(/retry in\s+([\d.]+)\s*s/i)
  if (!match) return null
  const sec = Number(match[1])
  if (!Number.isFinite(sec) || sec <= 0) return null
  return Math.ceil(sec)
}

function isLikelyGermanWord(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (!text) return false
  // Allow letters, umlauts, eszett, spaces and hyphens.
  return /^[A-Za-zÄÖÜäöüß\- ]+$/.test(text)
}

function isLikelyRussianText(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (!text) return false
  // One-word Russian translation only (hyphenated form allowed).
  if (/\s/.test(text)) return false
  return /^[А-Яа-яЁё-]+$/.test(text)
}

function parseCandidates(rawText) {
  const parsed = extractJSONArray(rawText)
  if (Array.isArray(parsed)) return parsed
  try {
    const asObject = JSON.parse(rawText)
    if (Array.isArray(asObject?.words)) return asObject.words
  } catch {
    // ignore
  }
  return null
}

function buildPrompt({ category, level, count, existingGerman }) {
  return [
    `Generate exactly ${count} German vocabulary items for category "${category}".`,
    `Target CEFR level MUST be ${level}.`,
    'Return ONLY valid JSON.',
    'Preferred shape: [{"german":"...", "russian":"...", "level":"...","spellingOk":true,"translationAccurate":true}].',
    'Alternative valid shape: {"words":[...]} with same fields.',
    'Rules:',
    '- german: correct spelling, natural German (no typos, no random forms).',
    '- russian: accurate translation in exactly ONE Russian word.',
    '- level must exactly match requested band.',
    '- spellingOk must be true only if spelling is correct.',
    '- translationAccurate must be true only if translation is accurate.',
    '- Avoid duplicates and slang.',
    `- Exclude these German words: ${JSON.stringify(existingGerman)}`
  ].join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' })
    return
  }

  const category = String(req.body?.category || '').trim()
  const levelRaw = String(req.body?.level || 'B1-B2').trim()
  const level = ALLOWED_LEVELS.has(levelRaw) ? levelRaw : 'B1-B2'
  const count = Number(req.body?.count || 15)
  const existingGerman = Array.isArray(req.body?.existingGerman) ? req.body.existingGerman : []

  if (!category) {
    res.status(400).json({ error: 'Category is required' })
    return
  }

  const existingSet = new Set(existingGerman.map((w) => normalize(w)))

  try {
    const unique = []
    const localSet = new Set(existingSet)
    const maxAttempts = 3
    let lastRetryAfterSec = null

    for (let attempt = 0; attempt < maxAttempts && unique.length < count; attempt += 1) {
      const requestCount = Math.max(count - unique.length + 5, 8)
      const response = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.35,
            topP: 0.9,
            responseMimeType: 'application/json'
          },
          contents: [{ role: 'user', parts: [{ text: buildPrompt({
            category,
            level,
            count: requestCount,
            existingGerman: [...existingGerman, ...Array.from(localSet)]
          }) }] }]
        })
      })

      const payload = await response.json()
      if (!response.ok) {
        const message = payload?.error?.message || 'Gemini request failed'
        const retryAfterSec = extractRetryAfterSec(message)
        lastRetryAfterSec = retryAfterSec
        res.status(502).json({ error: message, retryAfterSec })
        return
      }

      const parts = payload?.candidates?.[0]?.content?.parts
      const rawText = Array.isArray(parts)
        ? parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('\n')
        : ''
      const words = parseCandidates(rawText)
      if (!Array.isArray(words)) continue

      for (const item of words) {
        const german = String(item?.german || '').trim()
        const russian = String(item?.russian || '').trim()
        const itemLevel = String(item?.level || '').trim()
        const spellingOk = item?.spellingOk !== false
        const translationAccurate = item?.translationAccurate !== false

        if (!german || !russian) continue
        if (!isLikelyGermanWord(german) || !isLikelyRussianText(russian)) continue
        if (itemLevel && itemLevel !== level) continue
        if (!spellingOk || !translationAccurate) continue

        const key = normalize(german)
        if (localSet.has(key)) continue
        localSet.add(key)
        unique.push({ german, russian })
        if (unique.length >= count) break
      }
    }
    if (unique.length === 0) {
      res.status(502).json({
        error: 'Could not generate validated words for this category and level.',
        retryAfterSec: lastRetryAfterSec
      })
      return
    }

    res.status(200).json({ words: unique.slice(0, count), level })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error'
    })
  }
}


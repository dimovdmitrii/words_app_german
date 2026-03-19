const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function normalize(text) {
  return String(text || '').trim().toLowerCase()
}

function extractTextFromGeminiResponse(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n')
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
  const level = String(req.body?.level || 'B1-B2').trim()
  const count = Number(req.body?.count || 15)
  const existingGerman = Array.isArray(req.body?.existingGerman) ? req.body.existingGerman : []

  if (!category) {
    res.status(400).json({ error: 'Category is required' })
    return
  }

  const existingSet = new Set(existingGerman.map((w) => normalize(w)))

  const prompt = [
    `Generate exactly ${count} German vocabulary words for category "${category}".`,
    `Difficulty level must be ${level}.`,
    'Return ONLY a JSON array. No markdown, no explanations.',
    'Each item must be: {"german":"...", "russian":"..."}',
    'Use concise single-word or short phrase entries.',
    'Avoid slang and duplicates.',
    'If a word from the existing list appears, replace it with another word.',
    `Existing German words to exclude: ${JSON.stringify(existingGerman)}`
  ].join('\n')

  try {
    const response = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.6,
          topP: 0.95,
          responseMimeType: 'application/json'
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    })

    const payload = await response.json()
    if (!response.ok) {
      const message = payload?.error?.message || 'Gemini request failed'
      const retryAfterSec = extractRetryAfterSec(message)
      res.status(502).json({ error: message, retryAfterSec })
      return
    }

    const rawText = extractTextFromGeminiResponse(payload)
    const parsed = extractJSONArray(rawText)
    if (!Array.isArray(parsed)) {
      res.status(502).json({ error: 'Invalid response format from Gemini' })
      return
    }

    const unique = []
    const localSet = new Set(existingSet)
    for (const item of parsed) {
      const german = String(item?.german || '').trim()
      const russian = String(item?.russian || '').trim()
      if (!german || !russian) continue

      const key = normalize(german)
      if (localSet.has(key)) continue
      localSet.add(key)
      unique.push({ german, russian })
      if (unique.length >= count) break
    }

    res.status(200).json({ words: unique })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error'
    })
  }
}


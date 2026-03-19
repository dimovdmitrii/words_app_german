import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function normalize(text: string): string {
  return String(text || '').trim().toLowerCase()
}

function extractTextFromGeminiResponse(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const candidate = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]
  const parts = candidate?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('\n')
}

function extractJSONArray(rawText: string): unknown[] | null {
  const trimmed = rawText.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced ? fenced[1].trim() : trimmed
  const start = source.indexOf('[')
  const end = source.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(source.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function generateWordsWithGemini(
  apiKey: string,
  model: string,
  category: string,
  level: string,
  count: number,
  existingGerman: string[]
): Promise<Array<{ german: string; russian: string }>> {
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
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
    }
  )

  const payload = await response.json()
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? ((payload as { error?: { message?: string } }).error?.message ?? 'Gemini request failed')
        : 'Gemini request failed'
    throw new Error(message)
  }

  const rawText = extractTextFromGeminiResponse(payload)
  const words = extractJSONArray(rawText)
  if (!words) throw new Error('Invalid response format from Gemini')

  const localSet = new Set(existingGerman.map((w) => normalize(w)))
  const unique: Array<{ german: string; russian: string }> = []
  for (const item of words) {
    const german = item && typeof item === 'object' && 'german' in item ? String((item as { german?: string }).german || '').trim() : ''
    const russian = item && typeof item === 'object' && 'russian' in item ? String((item as { russian?: string }).russian || '').trim() : ''
    if (!german || !russian) continue
    const key = normalize(german)
    if (localSet.has(key)) continue
    localSet.add(key)
    unique.push({ german, russian })
    if (unique.length >= count) break
  }

  return unique
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const geminiApiKey = env.GEMINI_API_KEY
  const geminiModel = env.GEMINI_MODEL || 'gemini-2.5-flash'

  return {
    plugins: [
      react(),
      {
        name: 'local-gemini-api',
        configureServer(server) {
          server.middlewares.use('/api/generate-words', async (req, res) => {
            if (req.method !== 'POST') return

            try {
              if (!geminiApiKey) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing GEMINI_API_KEY in .env.local' }))
                return
              }

              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })

              req.on('end', async () => {
                try {
                  const parsed = JSON.parse(body || '{}') as {
                    category?: string
                    level?: string
                    count?: number
                    existingGerman?: string[]
                  }
                  const category = String(parsed.category || '').trim()
                  if (!category) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: 'Category is required' }))
                    return
                  }

                  const level = String(parsed.level || 'B1-B2').trim()
                  const count = Number(parsed.count || 15)
                  const existingGerman = Array.isArray(parsed.existingGerman) ? parsed.existingGerman : []

                  const words = await generateWordsWithGemini(
                    geminiApiKey,
                    geminiModel,
                    category,
                    level,
                    count,
                    existingGerman
                  )

                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ words }))
                } catch (error) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: error instanceof Error ? error.message : 'Local API failed'
                    })
                  )
                }
              })
            } catch (error) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: error instanceof Error ? error.message : 'Local API failed'
                })
              )
            }
          })
        }
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'words.json'],
        manifest: {
          name: 'Deutsch Vokabeln',
          short_name: 'Vokabeln',
          description: 'German vocabulary trainer – learn words with spaced repetition',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'fullscreen',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
          ],
          categories: ['education']
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json,mp3}']
        },
        devOptions: { enabled: true }
      })
    ]
  }
})

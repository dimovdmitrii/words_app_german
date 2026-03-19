import { useEffect, useMemo, useRef, useState } from 'react'
import type { VocabEntry } from '../types'

export type ManagerTab = 'categories' | 'words' | 'add' | 'generate'
type WordsSubTab = 'active' | 'custom' | 'deleted'

const CATEGORY_COLORS = [
  '#38bdf8', '#a78bfa', '#34d399', '#fbbf24',
  '#f472b6', '#60a5fa', '#fb923c', '#e879f9',
]

function getCategoryColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]
}

const TAB_TITLES: Record<ManagerTab, string> = {
  categories: 'Categories',
  words: 'Manage Words',
  add: 'Add Word',
  generate: 'Generate Words',
}

interface WordsManagerProps {
  initialTab?: ManagerTab
  categories: string[]
  activeCategories: string[]
  allWords: VocabEntry[]
  onUpdateCategories: (cats: string[]) => void
  baseWords: VocabEntry[]
  customWords: VocabEntry[]
  deletedBaseIds: string[]
  onDeleteBase: (id: string) => void
  onDeleteCustom: (id: string) => void
  onRestoreBase: (id: string) => void
  onAddWord: (german: string, russian: string, category: string) => string | null
  onAddWordsBulk: (
    words: Array<{ german: string; russian: string; category: string }>
  ) => { added: number; skipped: number }
  onClose: () => void
}

interface GeneratedCandidate {
  id: string
  german: string
  russian: string
  category: string
  selected: boolean
}

const CEFR_LEVEL_OPTIONS = ['A1-A2', 'B1-B2', 'C1-C2'] as const
type CefrBand = (typeof CEFR_LEVEL_OPTIONS)[number]

export function WordsManager({
  initialTab = 'categories',
  categories,
  activeCategories,
  allWords,
  onUpdateCategories,
  baseWords,
  customWords,
  deletedBaseIds,
  onDeleteBase,
  onDeleteCustom,
  onRestoreBase,
  onAddWord,
  onAddWordsBulk,
  onClose,
}: WordsManagerProps) {
  const [tab, setTab] = useState<ManagerTab>(initialTab)

  // — Categories tab —
  const [selectedCats, setSelectedCats] = useState<string[]>(activeCategories)

  // — Words tab —
  const [wordsTab, setWordsTab] = useState<WordsSubTab>('active')
  const [search, setSearch] = useState('')

  // — Add tab —
  const [german, setGerman] = useState('')
  const [russian, setRussian] = useState('')
  const [addCategory, setAddCategory] = useState('')
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const germanRef = useRef<HTMLInputElement>(null)

  // — Generate tab —
  const [generateCategory, setGenerateCategory] = useState('')
  const [generateLevel, setGenerateLevel] = useState<CefrBand>('B1-B2')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateInfo, setGenerateInfo] = useState<string | null>(null)
  const [generatedWords, setGeneratedWords] = useState<GeneratedCandidate[]>([])
  const [rejectedGeneratedGerman, setRejectedGeneratedGerman] = useState<string[]>([])
  const GENERATE_TARGET = 15
  const GENERATE_COOLDOWN_MS = 15000
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [cooldownNow, setCooldownNow] = useState(Date.now())

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const timer = window.setInterval(() => {
      setCooldownNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil])

  const cooldownRemainingSec = Math.max(0, Math.ceil((cooldownUntil - cooldownNow) / 1000))
  const isGenerateCooldown = cooldownRemainingSec > 0

  const formatCooldown = (sec: number) => {
    if (sec >= 60) {
      const min = Math.ceil(sec / 60)
      return `${min} min`
    }
    return `${sec} sec`
  }

  const extractRetrySeconds = (message: string): number | null => {
    const match = message.match(/retry in\s+([\d.]+)\s*s/i)
    if (!match) return null
    const seconds = Number(match[1])
    if (!Number.isFinite(seconds) || seconds <= 0) return null
    return Math.ceil(seconds)
  }

  const applyRateLimitCooldown = (message: string) => {
    const retrySec = extractRetrySeconds(message)
    if (!retrySec) return
    setCooldownNow(Date.now())
    setCooldownUntil(Date.now() + retrySec * 1000)
    setGenerateError(`Limit reached. Try again in ${formatCooldown(retrySec)}.`)
  }

  // Category word counts
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const w of allWords) {
      if (w.category) counts[w.category] = (counts[w.category] || 0) + 1
    }
    return counts
  }, [allWords])

  const isAllSelected = selectedCats.length === 0

  // — Category handlers —
  const toggleCat = (cat: string) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const selectAll = () => {
    setSelectedCats([])
  }

  const handleApplyCategories = () => {
    onUpdateCategories(selectedCats)
    onClose()
  }

  const applyBtnLabel = isAllSelected
    ? 'Apply — All words'
    : `Apply (${selectedCats.length} selected)`

  const filteredCategorySuggestions = useMemo(() => {
    const query = addCategory.trim().toLowerCase()
    if (!query) return categories
    return categories.filter((cat) => cat.toLowerCase().includes(query))
  }, [categories, addCategory])

  const filteredGenerateSuggestions = useMemo(() => {
    const query = generateCategory.trim().toLowerCase()
    if (!query) return categories
    return categories.filter((cat) => cat.toLowerCase().includes(query))
  }, [categories, generateCategory])

  // — Words tab helpers —
  const deletedSet = new Set(deletedBaseIds)
  const activeBase = baseWords.filter(w => !deletedSet.has(w.id))
  const deletedWords = baseWords.filter(w => deletedSet.has(w.id))

  const filterWords = (words: VocabEntry[]) => {
    if (!search.trim()) return words
    const s = search.toLowerCase()
    return words.filter(
      w => w.german.toLowerCase().includes(s) || w.russian.toLowerCase().includes(s)
    )
  }

  const currentWords =
    wordsTab === 'active'  ? filterWords(activeBase) :
    wordsTab === 'custom'  ? filterWords(customWords) :
                             filterWords(deletedWords)

  // — Add word handler —
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const g = german.trim()
    const r = russian.trim()
    if (!g || !r) {
      setAddError('Fill in both fields')
      return
    }
    const err = onAddWord(g, r, addCategory.trim())
    if (err) {
      setAddError(err)
      return
    }
    setGerman('')
    setRussian('')
    setAddCategory('')
    setAddError(null)
    setAddSuccess(true)
    setTimeout(() => setAddSuccess(false), 2000)
    germanRef.current?.focus()
  }

  const requestGeneratedWords = async (
    category: string,
    level: CefrBand,
    count: number,
    excludedGerman: string[]
  ): Promise<Array<{ german: string; russian: string }>> => {
    const response = await fetch('/api/generate-words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        level,
        count,
        existingGerman: excludedGerman
      })
    })

    const data = await response.json()
    if (!response.ok) {
      const retryAfterSec =
        typeof data?.retryAfterSec === 'number' && data.retryAfterSec > 0
          ? Math.ceil(data.retryAfterSec)
          : null
      const baseMessage = data?.error || 'Failed to generate words'
      const enrichedMessage = retryAfterSec
        ? `${baseMessage} Please retry in ${retryAfterSec}s.`
        : baseMessage
      throw new Error(enrichedMessage)
    }
    return Array.isArray(data.words) ? data.words : []
  }

  const refillGeneratedWords = async (
    currentCandidates: GeneratedCandidate[],
    additionallyRejected: string[] = []
  ) => {
    const category = generateCategory.trim()
    if (!category) return

    const missingCount = GENERATE_TARGET - currentCandidates.length
    if (missingCount <= 0) return
    if (isGenerating) return
    if (isGenerateCooldown) {
      setGenerateError(`Please wait ${formatCooldown(cooldownRemainingSec)} before next generation request.`)
      return
    }

    setIsGenerating(true)
    setGenerateError(null)
    setCooldownNow(Date.now())
    setCooldownUntil(Date.now() + GENERATE_COOLDOWN_MS)

    try {
      const excludedGerman = [
        ...allWords.map((w) => w.german),
        ...currentCandidates.map((w) => w.german),
        ...rejectedGeneratedGerman,
        ...additionallyRejected
      ]
      const words = await requestGeneratedWords(category, generateLevel, missingCount, excludedGerman)
      if (words.length === 0) return

      const newCandidates: GeneratedCandidate[] = words.map(
        (w: { german: string; russian: string }, index: number) => ({
          id: `${Date.now()}_${index}_${w.german}`,
          german: w.german,
          russian: w.russian,
          category,
          selected: true
        })
      )

      setGeneratedWords((prev) => {
        const seen = new Set(prev.map((w) => w.german.toLowerCase()))
        const merged = [...prev]
        for (const item of newCandidates) {
          const key = item.german.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          merged.push(item)
        }
        return merged
      })
      setGenerateInfo('List refilled')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Refill generation failed'
      applyRateLimitCooldown(message)
      setGenerateError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateWords = async () => {
    const category = generateCategory.trim()
    if (!category) {
      setGenerateError('Set category first')
      return
    }

    if (isGenerateCooldown) {
      setGenerateError(`Please wait ${formatCooldown(cooldownRemainingSec)} before next generation request.`)
      return
    }

    setIsGenerating(true)
    setGenerateError(null)
    setGenerateInfo(null)
    setRejectedGeneratedGerman([])
    setCooldownNow(Date.now())
    setCooldownUntil(Date.now() + GENERATE_COOLDOWN_MS)

    try {
      const words = await requestGeneratedWords(
        category,
        generateLevel,
        GENERATE_TARGET,
        allWords.map((w) => w.german)
      )
      const candidates: GeneratedCandidate[] = words.map(
        (w: { german: string; russian: string }, index: number) => ({
          id: `${Date.now()}_${index}_${w.german}`,
          german: w.german,
          russian: w.russian,
          category,
          selected: true
        })
      )
      setGeneratedWords(candidates)
      setGenerateInfo(`Generated ${candidates.length} words`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Generation failed'
      applyRateLimitCooldown(message)
      setGenerateError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleGeneratedSelection = (id: string) => {
    setGeneratedWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, selected: !w.selected } : w))
    )
  }

  const removeGeneratedWord = (id: string) => {
    const removedWord = generatedWords.find((w) => w.id === id)
    const nextWords = generatedWords.filter((w) => w.id !== id)
    setGeneratedWords(nextWords)

    if (removedWord) {
      const normalized = removedWord.german.toLowerCase().trim()
      const updatedRejected = [...rejectedGeneratedGerman, normalized]
      setRejectedGeneratedGerman(updatedRejected)
      setGenerateInfo('Word removed. Use "Refill to 15" to generate replacement.')
    }
  }

  const handleRefillToTarget = () => {
    void refillGeneratedWords(generatedWords)
  }

  const handleTryAgain = () => {
    if (isGenerateCooldown || isGenerating) return
    if (generatedWords.length > 0 && generatedWords.length < GENERATE_TARGET) {
      void refillGeneratedWords(generatedWords)
      return
    }
    void handleGenerateWords()
  }

  const handleAddGeneratedWords = () => {
    const selected = generatedWords.filter((w) => w.selected)
    if (selected.length === 0) {
      setGenerateError('Select at least one word')
      return
    }

    const result = onAddWordsBulk(
      selected.map((w) => ({
        german: w.german,
        russian: w.russian,
        category: w.category
      }))
    )
    setGenerateInfo(`Added: ${result.added}, skipped: ${result.skipped}`)
    setGeneratedWords((prev) => prev.filter((w) => !w.selected))
  }

  // Active filter badge shown in header
  const headerBadge =
    activeCategories.length > 0
      ? activeCategories.length === 1
        ? activeCategories[0]
        : `${activeCategories.length} categories`
      : null

  return (
    <div className="menu-overlay" onClick={onClose}>
      <div className="wm-screen" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="wm-header">
          <div className="wm-header-left">
            <h2 className="wm-title">{TAB_TITLES[tab]}</h2>
            {tab === 'categories' && headerBadge && (
              <span className="wm-header-badge">{headerBadge}</span>
            )}
          </div>
          <button className="wm-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="wm-content">

          {/* ════ CATEGORIES TAB ════ */}
          {tab === 'categories' && (
            <>
              {categories.length === 0 ? (
                <p className="wm-empty">
                  No categories yet. Add words with categories first.
                </p>
              ) : (
                <>
                  {/* All words row */}
                  <div
                    className={`cat-all-row${isAllSelected ? ' active' : ''}`}
                    onClick={selectAll}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && selectAll()}
                    aria-pressed={isAllSelected}
                  >
                    <span
                      className="cat-indicator"
                      style={{
                        background: isAllSelected ? 'var(--accent)' : 'var(--muted)',
                        boxShadow: isAllSelected ? '0 0 8px rgba(56,189,248,0.55)' : 'none',
                      }}
                    />
                    <span className="cat-name">All words</span>
                    <span className="cat-count">{allWords.length}</span>
                  </div>

                  <div className="cat-divider" />

                  {/* Category list */}
                  <div className="cat-list">
                    {categories.map(cat => {
                      const color = getCategoryColor(cat)
                      const isSelected = selectedCats.includes(cat)
                      return (
                        <div
                          key={cat}
                          className={`cat-item${isSelected ? ' selected' : ''}`}
                          style={isSelected
                            ? { borderColor: `${color}55`, background: `${color}10` }
                            : {}
                          }
                          onClick={() => toggleCat(cat)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => e.key === 'Enter' && toggleCat(cat)}
                          aria-pressed={isSelected}
                        >
                          <span
                            className="cat-indicator"
                            style={{
                              background: isSelected ? color : 'var(--muted)',
                              boxShadow: isSelected ? `0 0 8px ${color}88` : 'none',
                            }}
                          />
                          <span className="cat-name">{cat}</span>
                          <span className="cat-count">{catCounts[cat] ?? 0}</span>
                          {isSelected && (
                            <span className="cat-check" style={{ color }}>✓</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Apply bar */}
                  <div className="cat-apply-bar">
                    <button
                      className="menu-btn primary"
                      style={{ width: '100%' }}
                      onClick={handleApplyCategories}
                    >
                      {applyBtnLabel}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ════ WORDS TAB ════ */}
          {tab === 'words' && (
            <>
              <div className="wm-subtabs">
                <button
                  className={`wm-subtab${wordsTab === 'active' ? ' active' : ''}`}
                  onClick={() => setWordsTab('active')}
                >
                  Base ({activeBase.length})
                </button>
                <button
                  className={`wm-subtab${wordsTab === 'custom' ? ' active' : ''}`}
                  onClick={() => setWordsTab('custom')}
                >
                  Custom ({customWords.length})
                </button>
                <button
                  className={`wm-subtab${wordsTab === 'deleted' ? ' active' : ''}`}
                  onClick={() => setWordsTab('deleted')}
                >
                  Deleted ({deletedWords.length})
                </button>
              </div>

              <input
                type="text"
                className="wm-search"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div className="wm-word-list">
                {currentWords.length === 0 ? (
                  <p className="wm-empty">{search ? 'Nothing found' : 'No words'}</p>
                ) : (
                  currentWords.map(w => (
                    <div key={w.id} className="wm-word-item">
                      <div className="wm-word-info">
                        <div className="wm-word-german">{w.german}</div>
                        <div className="wm-word-meta">
                          <span className="wm-word-russian">{w.russian}</span>
                          {w.category && (
                            <span
                              className="wm-cat-tag"
                              style={{
                                color: getCategoryColor(w.category),
                                borderColor: `${getCategoryColor(w.category)}50`,
                                background: `${getCategoryColor(w.category)}18`,
                              }}
                            >
                              {w.category}
                            </span>
                          )}
                        </div>
                      </div>
                      {wordsTab === 'deleted' ? (
                        <button
                          className="wm-action-btn restore"
                          onClick={() => onRestoreBase(w.id)}
                          aria-label="Restore"
                        >
                          ↩
                        </button>
                      ) : (
                        <button
                          className="wm-action-btn delete"
                          onClick={() =>
                            wordsTab === 'custom'
                              ? onDeleteCustom(w.id)
                              : onDeleteBase(w.id)
                          }
                          aria-label="Delete"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ════ ADD TAB ════ */}
          {tab === 'add' && (
            <form className="wm-form" onSubmit={handleAddSubmit} noValidate>
              <div className="wm-form-field">
                <label className="wm-form-label" htmlFor="wm-german">
                  German word *
                </label>
                <input
                  id="wm-german"
                  className="wm-form-input"
                  type="text"
                  value={german}
                  onChange={e => { setGerman(e.target.value); setAddError(null) }}
                  placeholder="der Tisch, gehen, schnell…"
                  autoComplete="off"
                  ref={germanRef}
                />
              </div>

              <div className="wm-form-field">
                <label className="wm-form-label" htmlFor="wm-russian">
                  Russian translation *
                </label>
                <input
                  id="wm-russian"
                  className="wm-form-input"
                  type="text"
                  value={russian}
                  onChange={e => { setRussian(e.target.value); setAddError(null) }}
                  placeholder="перевод"
                  autoComplete="off"
                />
              </div>

              <div className="wm-form-field">
                <label className="wm-form-label" htmlFor="wm-add-cat">
                  Category (optional)
                </label>
                <input
                  id="wm-add-cat"
                  className="wm-form-input"
                  type="text"
                  value={addCategory}
                  onChange={e => {
                    setAddCategory(e.target.value)
                    setShowCategorySuggestions(true)
                  }}
                  onFocus={() => setShowCategorySuggestions(true)}
                  onBlur={() => {
                    window.setTimeout(() => setShowCategorySuggestions(false), 120)
                  }}
                  placeholder="например: IT, Verben…"
                  autoComplete="off"
                />
                {showCategorySuggestions && filteredCategorySuggestions.length > 0 && (
                  <div className="wm-category-suggestions">
                    {filteredCategorySuggestions.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className="wm-category-suggestion-item"
                        onClick={() => {
                          setAddCategory(cat)
                          setShowCategorySuggestions(false)
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {addError && <p className="wm-form-error">{addError}</p>}

              {addSuccess && (
                <div className="wm-form-success">
                  <span>✓</span> Word added to learning pool!
                </div>
              )}

              <button type="submit" className="menu-btn primary">
                Add to learning pool
              </button>
            </form>
          )}

          {/* ════ GENERATE TAB ════ */}
          {tab === 'generate' && (
            <div className="wm-form">
              <div className="wm-form-field">
                <label className="wm-form-label" htmlFor="wm-generate-cat">
                  Category *
                </label>
                <input
                  id="wm-generate-cat"
                  className="wm-form-input"
                  type="text"
                  value={generateCategory}
                  onChange={(e) => setGenerateCategory(e.target.value)}
                  placeholder="например: Reisen, Arbeit, Medizin..."
                  autoComplete="off"
                  list="wm-generate-cat-list"
                />
                <datalist id="wm-generate-cat-list">
                  {filteredGenerateSuggestions.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="wm-form-field">
                <label className="wm-form-label" htmlFor="wm-generate-level">
                  Level *
                </label>
                <select
                  id="wm-generate-level"
                  className="wm-form-input"
                  value={generateLevel}
                  onChange={(e) => setGenerateLevel(e.target.value as CefrBand)}
                >
                  {CEFR_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="menu-btn primary"
                onClick={handleGenerateWords}
                disabled={isGenerating || isGenerateCooldown}
              >
                {isGenerating
                  ? 'Generating...'
                  : isGenerateCooldown
                  ? `Try in ${formatCooldown(cooldownRemainingSec)}`
                  : `Generate 15 words (${generateLevel})`}
              </button>

              {generateError && <p className="wm-form-error">{generateError}</p>}
              {generateError && (
                <button
                  type="button"
                  className="menu-btn"
                  onClick={handleTryAgain}
                  disabled={isGenerating || isGenerateCooldown}
                >
                  {isGenerateCooldown
                    ? `Try again in ${formatCooldown(cooldownRemainingSec)}`
                    : 'Try again'}
                </button>
              )}
              {generateInfo && <div className="wm-form-success">{generateInfo}</div>}

              {generatedWords.length > 0 && (
                <>
                  {generatedWords.length < GENERATE_TARGET && (
                    <button
                      type="button"
                      className="menu-btn"
                      onClick={handleRefillToTarget}
                      disabled={isGenerating || isGenerateCooldown}
                    >
                      {isGenerating
                        ? 'Refilling...'
                        : isGenerateCooldown
                        ? `Try in ${formatCooldown(cooldownRemainingSec)}`
                        : `Refill to ${GENERATE_TARGET} (${GENERATE_TARGET - generatedWords.length} missing)`}
                    </button>
                  )}

                  <div className="wm-word-list">
                    {generatedWords.map((w) => (
                      <div key={w.id} className="wm-word-item">
                        <button
                          type="button"
                          className={`wm-select-btn${w.selected ? ' selected' : ''}`}
                          onClick={() => toggleGeneratedSelection(w.id)}
                          aria-label={w.selected ? 'Deselect word' : 'Select word'}
                        >
                          {w.selected ? '✓' : ''}
                        </button>
                        <div className="wm-word-info">
                          <div className="wm-word-german">{w.german}</div>
                          <div className="wm-word-russian">{w.russian}</div>
                        </div>
                        <button
                          type="button"
                          className="wm-action-btn delete"
                          onClick={() => removeGeneratedWord(w.id)}
                          aria-label="Remove generated word"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="menu-btn primary"
                    onClick={handleAddGeneratedWords}
                  >
                    Add selected to pool
                  </button>
                </>
              )}
            </div>
          )}

        </div>{/* /wm-content */}

        {/* ── Bottom tab navigation ── */}
        <nav className="wm-tabs" aria-label="Section">
          <button
            className={`wm-tab-btn${tab === 'categories' ? ' active' : ''}`}
            onClick={() => setTab('categories')}
            aria-current={tab === 'categories' ? 'page' : undefined}
          >
            <span className="wm-tab-icon" aria-hidden="true">🏷️</span>
            <span>Categories</span>
            {activeCategories.length > 0 && (
              <span className="wm-tab-dot" />
            )}
          </button>

          <button
            className={`wm-tab-btn${tab === 'words' ? ' active' : ''}`}
            onClick={() => setTab('words')}
            aria-current={tab === 'words' ? 'page' : undefined}
          >
            <span className="wm-tab-icon" aria-hidden="true">📚</span>
            <span>Words</span>
          </button>

          <button
            className={`wm-tab-btn${tab === 'add' ? ' active' : ''}`}
            onClick={() => setTab('add')}
            aria-current={tab === 'add' ? 'page' : undefined}
          >
            <span className="wm-tab-icon wm-tab-icon-add" aria-hidden="true">✚</span>
            <span>Add Word</span>
          </button>

          <button
            className={`wm-tab-btn${tab === 'generate' ? ' active' : ''}`}
            onClick={() => setTab('generate')}
            aria-current={tab === 'generate' ? 'page' : undefined}
          >
            <span className="wm-tab-icon" aria-hidden="true">✨</span>
            <span>Generate</span>
          </button>
        </nav>

      </div>{/* /wm-screen */}
    </div>
  )
}

import { useState, useMemo, useRef } from 'react'
import type { VocabEntry } from '../types'

export type ManagerTab = 'categories' | 'words' | 'add'
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
  onClose: () => void
}

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
  onClose,
}: WordsManagerProps) {
  const [tab, setTab] = useState<ManagerTab>(initialTab)

  // — Categories tab —
  const [selectedCats, setSelectedCats] = useState<string[]>(activeCategories)
  const [applyFeedback, setApplyFeedback] = useState(false)

  // — Words tab —
  const [wordsTab, setWordsTab] = useState<WordsSubTab>('active')
  const [search, setSearch] = useState('')

  // — Add tab —
  const [german, setGerman] = useState('')
  const [russian, setRussian] = useState('')
  const [addCategory, setAddCategory] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const germanRef = useRef<HTMLInputElement>(null)

  // Category word counts
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const w of allWords) {
      if (w.category) counts[w.category] = (counts[w.category] || 0) + 1
    }
    return counts
  }, [allWords])

  // Whether pending selection differs from what's applied in state
  const isApplied = useMemo(() => {
    if (selectedCats.length !== activeCategories.length) return false
    const a = [...selectedCats].sort().join('\0')
    const b = [...activeCategories].sort().join('\0')
    return a === b
  }, [selectedCats, activeCategories])

  const isAllSelected = selectedCats.length === 0

  // — Category handlers —
  const toggleCat = (cat: string) => {
    setApplyFeedback(false)
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const selectAll = () => {
    setApplyFeedback(false)
    setSelectedCats([])
  }

  const handleApplyCategories = () => {
    onUpdateCategories(selectedCats)
    setApplyFeedback(true)
    setTimeout(() => setApplyFeedback(false), 1800)
  }

  const applyBtnLabel = isAllSelected
    ? 'Apply — All words'
    : `Apply (${selectedCats.length} selected)`

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
                    {applyFeedback ? (
                      <div className="cat-apply-feedback">
                        <span className="cat-apply-check">✓</span> Applied!
                      </div>
                    ) : (
                      <button
                        className={`menu-btn${!isApplied ? ' primary' : ''}`}
                        style={{ width: '100%' }}
                        onClick={handleApplyCategories}
                      >
                        {applyBtnLabel}
                      </button>
                    )}
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
                  list="wm-cat-datalist"
                  value={addCategory}
                  onChange={e => setAddCategory(e.target.value)}
                  placeholder="например: IT, Verben…"
                  autoComplete="off"
                />
                <datalist id="wm-cat-datalist">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
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
            <span className="wm-tab-icon" aria-hidden="true">✚</span>
            <span>Add Word</span>
          </button>
        </nav>

      </div>{/* /wm-screen */}
    </div>
  )
}

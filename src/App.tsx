import { useState, useEffect, useCallback, useRef } from 'react'
import type { VocabEntry, LearningWord, AppState } from './types'
import { POOL_SIZE, INITIAL_NEEDED, WRONG_NEEDED, todayStr } from './types'
import {
  shuffle,
  getDueReviews,
  processCorrectReview,
  buildOptions,
  buildReviewOptions,
  addDays,
  pickRandomExcluding
} from './lib/algorithm'
import { loadState, saveState, createInitialState, clearState } from './lib/db'
import { QuestionCard } from './components/QuestionCard'
import { Menu, MenuButton } from './components/Menu'

const WORDS_URL = '/words.json'

type Phase = 'loading' | 'review' | 'learn' | 'round-complete'

export default function App() {
  const [vocabulary, setVocabulary] = useState<VocabEntry[]>([])
  const [state, setState] = useState<AppState | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [reviewQueue, setReviewQueue] = useState<LearningWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  // First pass queue (words not yet shown once)
  const [firstPassQueue, setFirstPassQueue] = useState<LearningWord[]>([])
  
  // Current word being displayed
  const [currentWord, setCurrentWord] = useState<LearningWord | null>(null)
  
  // Track last shown word ID to avoid same word twice in a row
  const lastShownIdRef = useRef<string | null>(null)

  // Track available options for current word (removed wrong answers disappear)
  const [currentOptions, setCurrentOptions] = useState<string[]>([])

  const totalWords = vocabulary.length
  const learnedCount = state?.learnedIds.length ?? 0
  const wordsLeft = totalWords - learnedCount
  const errorsCount = state?.totalErrors ?? 0

  const persist = useCallback(async (newState: AppState) => {
    setState(newState)
    await saveState({ ...newState, lastSaved: new Date().toISOString() })
  }, [])

  // Generate options when current word changes
  useEffect(() => {
    if (!state || !currentWord) return
    if (phase === 'learn') {
      setCurrentOptions(buildOptions(state.learningPool, currentWord))
    } else if (phase === 'review') {
      setCurrentOptions(buildReviewOptions(state.learningPool, state.learnedWords, currentWord))
    }
  }, [currentWord?.id, phase, state?.learningPool?.length])

  // Pick next word for learning
  const pickNextLearnWord = useCallback((
    pool: LearningWord[],
    firstPass: LearningWord[],
    lastId: string | null
  ): { word: LearningWord | null; newFirstPass: LearningWord[] } => {
    // If first pass has words, take from there
    if (firstPass.length > 0) {
      const word = firstPass[0]
      return { word, newFirstPass: firstPass.slice(1) }
    }
    // Otherwise pick random from pool (excluding last shown)
    const word = pickRandomExcluding(pool, lastId)
    return { word, newFirstPass: [] }
  }, [])

  const initApp = useCallback(async (words: VocabEntry[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = await loadState() as any
    if (saved && saved.learningPool.length > 0) {
      let migratedState: AppState = saved
      let needsSave = false
      
      if (!saved.remainingWordIds && typeof saved.nextVocabIndex === 'number') {
        const usedIds = new Set([
          ...saved.learningPool.map((w: LearningWord) => w.id),
          ...saved.learnedIds
        ])
        const remaining = words.filter(w => !usedIds.has(w.id))
        migratedState = {
          ...migratedState,
          remainingWordIds: shuffle(remaining.map(w => w.id))
        }
        needsSave = true
      }
      
      if (typeof saved.totalErrors !== 'number') {
        migratedState = { ...migratedState, totalErrors: 0 }
        needsSave = true
      }
      
      if (needsSave) {
        await saveState(migratedState)
      }
      
      setState(migratedState)
      const due = getDueReviews(migratedState.learnedWords)
      if (due.length > 0) {
        const shuffledDue = shuffle(due)
        setReviewQueue(shuffledDue)
        setCurrentWord(shuffledDue[0])
        setCurrentIndex(0)
        setPhase('review')
      } else {
        // Start with first pass - show each word once
        const shuffledPool = shuffle([...migratedState.learningPool])
        setFirstPassQueue(shuffledPool.slice(1))
        setCurrentWord(shuffledPool[0])
        lastShownIdRef.current = shuffledPool[0]?.id ?? null
        setPhase('learn')
      }
    } else if (words.length >= POOL_SIZE) {
      const initial = createInitialState(words)
      setState(initial)
      await saveState(initial)
      const shuffledPool = shuffle([...initial.learningPool])
      setFirstPassQueue(shuffledPool.slice(1))
      setCurrentWord(shuffledPool[0])
      lastShownIdRef.current = shuffledPool[0]?.id ?? null
      setPhase('learn')
    } else {
      setError('Not enough words in vocabulary (need at least ' + POOL_SIZE + ')')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const res = await fetch(WORDS_URL)
        if (!res.ok) throw new Error('Failed to load vocabulary')
        const data = await res.json()
        const words: VocabEntry[] = Array.isArray(data) ? data : data.words ?? []
        if (cancelled) return
        setVocabulary(words)
        await initApp(words)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      }
    }
    init()
    return () => { cancelled = true }
  }, [initApp])

  const handleReviewAnswer = useCallback(
    (answer: string) => {
      if (!state || reviewQueue.length === 0 || !currentWord) return
      const word = currentWord
      const correct = answer === word.russian

      if (!correct) {
        setCurrentOptions((opts) => opts.filter((o) => o !== answer))
        persist({ ...state, totalErrors: state.totalErrors + 1 })
        return
      }

      const updated = processCorrectReview(word)
      const newLearned = state.learnedWords.map((w) =>
        w.id === updated.id ? updated : w
      )
      const newState: AppState = { ...state, learnedWords: newLearned }
      persist(newState)

      if (currentIndex + 1 >= reviewQueue.length) {
        // All reviews done, switch to learning
        const shuffledPool = shuffle([...state.learningPool])
        setFirstPassQueue(shuffledPool.slice(1))
        setCurrentWord(shuffledPool[0])
        lastShownIdRef.current = shuffledPool[0]?.id ?? null
        setPhase('learn')
      } else {
        setCurrentIndex((i) => i + 1)
        setCurrentWord(reviewQueue[currentIndex + 1])
      }
    },
    [state, reviewQueue, currentIndex, currentWord, persist]
  )

  const handleLearnAnswer = useCallback(
    (answer: string) => {
      if (!state || !currentWord) return
      const word = currentWord
      const correct = answer === word.russian

      if (!correct) {
        // Wrong answer: remove option, reset streak, set needed=5
        setCurrentOptions((opts) => opts.filter((o) => o !== answer))
        
        const updatedWord: LearningWord = { ...word, streak: 0, needed: WRONG_NEEDED }
        const newPool = state.learningPool.map((w) =>
          w.id === word.id ? updatedWord : w
        )
        setCurrentWord(updatedWord)
        persist({ ...state, learningPool: newPool, totalErrors: state.totalErrors + 1 })
        return
      }

      // Correct answer
      const newStreak = word.streak + 1
      const learned = newStreak >= word.needed
      
      if (learned) {
        // Word learned! Remove from pool, add new word
        const poolWithout = state.learningPool.filter((w) => w.id !== word.id)
        const newLearnedIds = [...state.learnedIds, word.id]
        const newLearnedWords = [...state.learnedWords, { 
          ...word, 
          streak: newStreak, 
          reviewStage: 0, 
          nextReview: addDays(todayStr(), 1) 
        }]
        
        let newRemainingIds = [...state.remainingWordIds]
        let nextPool = poolWithout
        let newWordAdded: LearningWord | null = null
        
        if (newRemainingIds.length > 0) {
          const nextWordId = newRemainingIds[0]
          newRemainingIds = newRemainingIds.slice(1)
          const nextEntry = vocabulary.find(w => w.id === nextWordId)
          if (nextEntry) {
            newWordAdded = {
              ...nextEntry,
              streak: 0,
              needed: INITIAL_NEEDED,
              reviewStage: 0,
              nextReview: todayStr()
            }
            nextPool = [...poolWithout, newWordAdded]
          }
        }

        const newState: AppState = {
          ...state,
          learningPool: nextPool,
          learnedIds: newLearnedIds,
          learnedWords: newLearnedWords,
          remainingWordIds: newRemainingIds
        }
        persist(newState)

        if (nextPool.length === 0) {
          setPhase('round-complete')
          setCurrentWord(null)
          return
        }

        // New word should be shown immediately
        if (newWordAdded) {
          setCurrentWord(newWordAdded)
          lastShownIdRef.current = newWordAdded.id
          // Remove from first pass if it was there (shouldn't be, but safety)
          setFirstPassQueue(fp => fp.filter(w => w.id !== newWordAdded!.id))
        } else {
          // Pick random from updated pool
          const next = pickRandomExcluding(nextPool, word.id)
          if (next) {
            setCurrentWord(next)
            lastShownIdRef.current = next.id
          }
        }
      } else {
        // Not learned yet, update streak and pick next word
        const updatedWord: LearningWord = { ...word, streak: newStreak }
        const newPool = state.learningPool.map((w) =>
          w.id === word.id ? updatedWord : w
        )
        persist({ ...state, learningPool: newPool })

        // Update first pass queue if word was there
        const updatedFirstPass = firstPassQueue.map(w => 
          w.id === word.id ? updatedWord : w
        )

        // Pick next word
        const { word: nextWord, newFirstPass } = pickNextLearnWord(
          newPool.map(w => w.id === word.id ? updatedWord : w),
          updatedFirstPass,
          word.id
        )
        
        setFirstPassQueue(newFirstPass)
        if (nextWord) {
          setCurrentWord(nextWord)
          lastShownIdRef.current = nextWord.id
        }
      }
    },
    [state, currentWord, vocabulary, firstPassQueue, persist, pickNextLearnWord]
  )

  const handleRoundCompleteNext = useCallback(() => {
    if (!state) return
    const shuffledPool = shuffle([...state.learningPool])
    setFirstPassQueue(shuffledPool.slice(1))
    setCurrentWord(shuffledPool[0])
    lastShownIdRef.current = shuffledPool[0]?.id ?? null
    setPhase('learn')
  }, [state])

  const handleMenuContinue = useCallback(() => {
    setShowMenu(false)
  }, [])

  const handleReset = useCallback(async () => {
    await clearState()
    setShowMenu(false)
    lastShownIdRef.current = null
    setCurrentIndex(0)
    if (vocabulary.length >= POOL_SIZE) {
      const initial = createInitialState(vocabulary)
      setState(initial)
      await saveState(initial)
      const shuffledPool = shuffle([...initial.learningPool])
      setFirstPassQueue(shuffledPool.slice(1))
      setCurrentWord(shuffledPool[0])
      lastShownIdRef.current = shuffledPool[0]?.id ?? null
      setPhase('learn')
    }
  }, [vocabulary])

  const openMenu = useCallback(() => setShowMenu(true), [])
  const closeMenu = useCallback(() => setShowMenu(false), [])

  const menuElement = showMenu ? (
    <Menu
      totalWords={totalWords}
      learnedCount={learnedCount}
      wordsLeft={wordsLeft}
      errorsCount={errorsCount}
      onContinue={handleMenuContinue}
      onReset={handleReset}
      onClose={closeMenu}
    />
  ) : null

  if (error) {
    return (
      <div className="app">
        <div className="card">
          <h2 className="card-word">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="app">
        <div className="card">
          <p className="card-hint">Loading…</p>
        </div>
      </div>
    )
  }

  if (phase === 'round-complete') {
    return (
      <div className="app">
        <div className="card">
          <div className="card-header">
            <span></span>
            <MenuButton onClick={openMenu} />
          </div>
          <h2 className="card-word">All words learned!</h2>
          <p className="card-hint">Tap to continue with new words</p>
          <button className="option-btn primary" onClick={handleRoundCompleteNext}>
            Continue
          </button>
        </div>
        {menuElement}
      </div>
    )
  }

  if (phase === 'review' && currentWord && state) {
    return (
      <div className="app">
        <QuestionCard
          german={currentWord.german}
          options={currentOptions}
          correctAnswer={currentWord.russian}
          onAnswer={handleReviewAnswer}
          onMenuClick={openMenu}
          isReview
        />
        {menuElement}
      </div>
    )
  }

  if (phase === 'learn' && currentWord && state) {
    return (
      <div className="app">
        <QuestionCard
          german={currentWord.german}
          options={currentOptions}
          correctAnswer={currentWord.russian}
          onAnswer={handleLearnAnswer}
          onMenuClick={openMenu}
        />
        {menuElement}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="card">
        <div className="card-header">
          <span></span>
          <MenuButton onClick={openMenu} />
        </div>
        <h2 className="card-word">All done!</h2>
        <p className="card-hint">Add more words or come back later for reviews</p>
      </div>
      {menuElement}
    </div>
  )
}

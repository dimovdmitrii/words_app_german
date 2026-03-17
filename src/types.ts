/** Raw word from vocabulary list (words.json) */
export interface VocabEntry {
  id: string
  german: string
  russian: string
  category?: string
}

/** Word in the learning pool or review queue with progress */
export interface LearningWord extends VocabEntry {
  streak: number
  needed: number
  reviewStage: number
  nextReview: string // YYYY-MM-DD
}

/** Stored app state in IndexedDB */
export interface AppState {
  learningPool: LearningWord[]
  learnedIds: string[]
  learnedWords: LearningWord[] // for spaced repetition
  remainingWordIds: string[] // shuffled IDs of words not yet in pool
  totalErrors: number // total mistakes made
  lastSaved: string // ISO date
  customWords: VocabEntry[] // user-added words
  deletedBaseIds: string[] // IDs of deleted base vocabulary words
  activeCategories?: string[] // selected categories for learning (empty = all)
}

export const POOL_SIZE = 15
export const INITIAL_NEEDED = 6
export const WRONG_NEEDED = 5
export const REVIEW_STAGES_DAYS = [1, 3, 7] as const

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

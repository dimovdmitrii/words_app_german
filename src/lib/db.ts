import type { AppState, VocabEntry } from '../types'
import { POOL_SIZE } from '../types'
import { toLearningWord, shuffle } from './algorithm'

const DB_NAME = 'german-vocab-pwa'
const STORE = 'state'
const KEY = 'app'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
  })
}

export async function loadState(): Promise<AppState | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result?.data ?? null)
    tx.oncomplete = () => db.close()
  })
}

export async function saveState(state: AppState): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ id: KEY, data: state })
    tx.onerror = () => reject(tx.error)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
  })
}

/** Initialize state from vocabulary: random POOL_SIZE words, rest shuffled for later */
export function createInitialState(vocabulary: VocabEntry[]): AppState {
  const shuffled = shuffle([...vocabulary])
  const poolEntries = shuffled.slice(0, POOL_SIZE)
  const remaining = shuffled.slice(POOL_SIZE)
  
  const pool = poolEntries.map(toLearningWord)
  const remainingIds = remaining.map(w => w.id)
  
  return {
    learningPool: pool,
    learnedIds: [],
    learnedWords: [],
    remainingWordIds: remainingIds,
    totalErrors: 0,
    lastSaved: new Date().toISOString(),
    customWords: [],
    deletedBaseIds: [],
    activeCategories: []
  }
}

/** Generate unique ID for custom word */
export function generateWordId(): string {
  return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

/** Check if word already exists in vocabulary */
export function isDuplicate(
  german: string,
  vocabulary: VocabEntry[],
  customWords: VocabEntry[]
): boolean {
  const normalizedGerman = german.toLowerCase().trim()
  const allWords = [...vocabulary, ...customWords]
  return allWords.some(w => w.german.toLowerCase().trim() === normalizedGerman)
}

/** Clear all progress */
export async function clearState(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    tx.onerror = () => reject(tx.error)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
  })
}

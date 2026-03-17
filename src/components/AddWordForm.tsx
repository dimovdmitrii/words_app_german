import { useRef, useState } from 'react'

interface AddWordFormProps {
  onAdd: (german: string, russian: string, category: string) => string | null
  onClose: () => void
}

export function AddWordForm({ onAdd, onClose }: AddWordFormProps) {
  const [german, setGerman] = useState('')
  const [russian, setRussian] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)
  const germanInputRef = useRef<HTMLInputElement | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedGerman = german.trim()
    const trimmedRussian = russian.trim()
    
    if (!trimmedGerman || !trimmedRussian) {
      setError('Fill in both fields')
      return
    }
    
    const addError = onAdd(trimmedGerman, trimmedRussian, category.trim())
    if (addError) {
      setError(addError)
      return
    }
    
    setGerman('')
    setRussian('')
    setCategory('')
    setError(null)
    // вернуть фокус в поле немецкого слова для быстрого ввода серии
    if (germanInputRef.current) {
      germanInputRef.current.focus()
    }
  }

  return (
    <div className="menu-overlay" onClick={onClose}>
      <div className="menu-screen add-word-form" onClick={(e) => e.stopPropagation()}>
        <button className="menu-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="menu-title">Add Word</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="german">German</label>
            <input
              id="german"
              type="text"
              value={german}
              onChange={(e) => setGerman(e.target.value)}
              placeholder="der Tisch, gehen, schnell..."
              autoComplete="off"
              autoFocus
              ref={germanInputRef}
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="russian">Russian</label>
            <input
              id="russian"
              type="text"
              value={russian}
              onChange={(e) => setRussian(e.target.value)}
              placeholder="перевод"
              autoComplete="off"
            />
          </div>

          <div className="form-field">
            <label htmlFor="category">Category (optional)</label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="например: Еда, Глаголы..."
              autoComplete="off"
            />
          </div>
          
          {error && <p className="form-error">{error}</p>}
          
          <div className="menu-buttons">
            <button type="submit" className="menu-btn primary">
              Add to pool
            </button>
            <button type="button" className="menu-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

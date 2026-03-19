import type { ManagerTab } from './WordsManager'

interface MenuProps {
  totalWords: number
  learnedCount: number
  wordsLeft: number
  errorsCount: number
  onContinue: () => void
  onReset: () => void
  onClose: () => void
  onOpenLibrary: (tab: ManagerTab) => void
}

export function Menu({
  totalWords,
  learnedCount,
  wordsLeft,
  errorsCount,
  onContinue,
  onReset,
  onClose,
  onOpenLibrary,
}: MenuProps) {
  const handleReset = () => {
    if (window.confirm('Reset all progress? This cannot be undone.')) {
      onReset()
    }
  }

  return (
    <div className="menu-overlay" onClick={onClose}>
      <div className="menu-screen" onClick={(e) => e.stopPropagation()}>
        <button className="menu-close" onClick={onClose} aria-label="Close menu">
          ×
        </button>
        <h1 className="menu-title">Statistics</h1>

        <div className="stats-list">
          <div className="stats-row">
            <span className="stats-label">Total words:</span>
            <span className="stats-value">{totalWords}</span>
          </div>
          <div className="stats-row">
            <span className="stats-label">You learned:</span>
            <span className="stats-value">{learnedCount}</span>
          </div>
          <div className="stats-row">
            <span className="stats-label">Words left:</span>
            <span className="stats-value">{wordsLeft}</span>
          </div>
          <div className="stats-row">
            <span className="stats-label">Errors:</span>
            <span className="stats-value">{errorsCount}</span>
          </div>
        </div>

        <div className="menu-buttons">
          <button className="menu-btn primary" onClick={onContinue}>
            Continue learning
          </button>
         
          <button className="menu-btn" onClick={() => onOpenLibrary('add')}>
            Add Words
          </button>
         
          <button className="menu-btn danger" onClick={handleReset}>
            Reset Statistics
          </button>
        </div>
      </div>
    </div>
  )
}

export function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="hamburger" onClick={onClick} aria-label="Open menu">
      <span></span>
      <span></span>
      <span></span>
    </button>
  )
}

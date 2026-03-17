import { useState } from 'react'

interface CategorySelectorProps {
  categories: string[]
  activeCategories: string[]
  onChange: (categories: string[]) => void
  onClose: () => void
}

export function CategorySelector({
  categories,
  activeCategories,
  onChange,
  onClose
}: CategorySelectorProps) {
  const [selected, setSelected] = useState<string[]>(activeCategories)

  const toggleCategory = (category: string) => {
    setSelected((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const handleSelectAll = () => {
    setSelected([])
  }

  const handleApply = () => {
    onChange(selected)
  }

  const isActive = (category: string) =>
    selected.length === 0 ? true : selected.includes(category)

  return (
    <div className="menu-overlay" onClick={onClose}>
      <div className="menu-screen word-list-screen" onClick={(e) => e.stopPropagation()}>
        <button className="menu-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="menu-title">Categories</h2>

        {categories.length === 0 ? (
          <p className="word-empty">No categories yet. Add words with categories first.</p>
        ) : (
          <>
            <div className="word-tabs">
              <button
                className={`word-tab ${selected.length === 0 ? 'active' : ''}`}
                onClick={handleSelectAll}
              >
                All words
              </button>
            </div>

            <div className="word-list">
              {categories.map((category) => (
                <div
                  key={category}
                  className={`word-item ${isActive(category) ? 'active' : ''}`}
                  onClick={() => toggleCategory(category)}
                >
                  <div className="word-item-text">
                    <span className="word-german">{category}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="menu-buttons">
              <button className="menu-btn primary" onClick={handleApply}>
                Apply
              </button>
              <button className="menu-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}


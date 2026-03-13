import { useCallback, useState } from 'react'
import { MenuButton } from './Menu'

interface QuestionCardProps {
  german: string
  options: string[]
  correctAnswer: string
  onAnswer: (answer: string) => void
  onMenuClick: () => void
  isReview?: boolean
}

export function QuestionCard({
  german,
  options,
  correctAnswer,
  onAnswer,
  onMenuClick,
  isReview = false
}: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  const handleClick = useCallback(
    (option: string) => () => {
      if (selectedOption) return // Prevent double-click during animation
      
      const correct = option === correctAnswer
      setSelectedOption(option)
      setIsCorrect(correct)

      // After animation, call onAnswer
      setTimeout(() => {
        setSelectedOption(null)
        setIsCorrect(null)
        onAnswer(option)
      }, 400)
    },
    [correctAnswer, onAnswer, selectedOption]
  )

  return (
    <section className="card" role="main" aria-label="Vocabulary question">
      <div className="card-header">
        <p className="card-label">{isReview ? 'Review' : 'Learn'}</p>
        <MenuButton onClick={onMenuClick} />
      </div>
      <h2 className="card-word">{german}</h2>
      <p className="card-hint">
        {options.length < 5
          ? `${options.length} options left`
          : 'Choose the correct translation'}
      </p>
      <div className="options">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`option-btn ${
              selectedOption === opt
                ? isCorrect
                  ? 'correct'
                  : 'wrong'
                : ''
            }`}
            onClick={handleClick(opt)}
            disabled={selectedOption !== null}
          >
            {opt}
          </button>
        ))}
      </div>
    </section>
  )
}

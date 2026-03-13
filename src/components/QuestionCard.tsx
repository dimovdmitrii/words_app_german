import { useCallback, useState, useEffect, useRef } from 'react'
import { MenuButton } from './Menu'

function getAudioFileName(german: string): string {
  return `/sounds/${german}.mp3`
}

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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const playAudio = useCallback(() => {
    const audioPath = getAudioFileName(german)
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(audioPath)
    audioRef.current = audio
    audio.play().catch(() => {})
  }, [german])

  useEffect(() => {
    playAudio()
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [german])

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
      <div className="card-word-row">
        <h2 className="card-word">{german}</h2>
        <button className="speak-btn" onClick={playAudio} aria-label="Play pronunciation">
          🔊
        </button>
      </div>
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

import { useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  label: string
  min: number
  max: number
  initialValue?: number
  onConfirm: (amount: number) => void
  onCancel: () => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']

export default function NumberPadModal({
  label,
  min,
  max,
  initialValue,
  onConfirm,
  onCancel,
}: Props) {
  const [digits, setDigits] = useState(initialValue ? String(initialValue) : '')

  const value = digits === '' ? null : parseInt(digits, 10)
  const tooLow = value !== null && value < min
  const tooHigh = value !== null && value > max
  const canConfirm = value !== null && value > 0 && !tooHigh

  const pressKey = (key: string) => {
    if (key === 'clear') {
      setDigits('')
      return
    }
    if (key === 'back') {
      setDigits((d) => d.slice(0, -1))
      return
    }
    setDigits((d) => {
      const next = d === '0' ? key : d + key
      // Cap the raw input length so it can't overflow beyond max digit count.
      if (next.length > String(max).length) return d
      return next
    })
  }

  const confirm = () => {
    if (!canConfirm || value === null) return
    onConfirm(Math.min(Math.max(value, min), max))
  }

  return createPortal(
    <div className="numpad-backdrop" onClick={onCancel} role="presentation">
      <div className="numpad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="numpad-label">{label}</div>
        <div className={`numpad-display ${tooLow || tooHigh ? 'invalid' : ''}`}>
          ${digits || '0'}
        </div>
        <div className="numpad-range">
          {tooHigh ? `Max $${max}` : tooLow ? `Min $${min}` : `$${min} – $${max}`}
        </div>

        <div className="numpad-grid">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`numpad-key ${key === 'clear' || key === 'back' ? 'numpad-key-func' : ''}`}
              onClick={() => pressKey(key)}
            >
              {key === 'clear' ? 'C' : key === 'back' ? '⌫' : key}
            </button>
          ))}
        </div>

        <div className="numpad-actions">
          <button
            type="button"
            className="btn-poker btn-poker-ghost flex-grow-1"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-poker btn-poker-primary flex-grow-1"
            disabled={!canConfirm}
            onClick={confirm}
          >
            Enter
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

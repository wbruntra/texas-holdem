import './ChipStack.css'

type Props = {
  amount: number
  className?: string
  showAmount?: boolean
}

const CHIP_VALUES = [
  { value: 1000, color: 'gold' },
  { value: 500, color: 'purple' },
  { value: 100, color: 'black' },
  { value: 25, color: 'green' },
  { value: 5, color: 'red' },
  { value: 1, color: 'white' },
]

export default function ChipStack({ amount, className = '', showAmount = true }: Props) {
  // Simple greedy algorithm to get chips
  const getChips = (total: number) => {
    let remaining = total
    const chips: string[] = []

    // Limit total chips to avoid huge stacks?
    // Or just take top 10-15 chips to represent the bet?
    // If someone bets 10,000 in $1 chips, we die.

    for (const { value, color } of CHIP_VALUES) {
      const count = Math.floor(remaining / value)
      if (count > 0) {
        // Add chips, but cap per denomination to avoid rendering too many?
        // Let's cap at 5 per denomination for visual representation
        const renderCount = Math.min(count, 3)
        for (let i = 0; i < renderCount; i++) {
          chips.push(color)
        }
        remaining -= count * value // Subtract the full amount
      }
    }

    // Reverse so larger values are at bottom?
    // Usually larger chips are at the bottom of the stack in physical world for stability,
    // but in top-down view we might see top one.
    // Let's stack them bottom-up.
    return chips.reverse().slice(0, 8) // Hard cap max chips to keep it compact
  }

  const chips = getChips(amount)

  if (amount === 0) return null

  return (
    <div className={`chip-stack ${className}`}>
      <div className="chips-visual-stack">
        {chips.map((color, idx) => (
          <div
            key={idx}
            className={`poker-chip chip-${color}`}
            style={{
              marginTop: idx === 0 ? 0 : '-11px', // Stack overlap
              zIndex: idx,
            }}
          />
        ))}
      </div>
      {showAmount && <div className="chip-label">${amount}</div>}
    </div>
  )
}

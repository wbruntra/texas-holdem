import { useEffect, useState, useRef } from 'react'
import './PotWinAnimation.css'

export type WinnerPayout = {
  playerId: string | number
  position: number
  amount: number
  name: string
}

type Props = {
  winners: WinnerPayout[]
  seatPositions: Map<number, { left: number; top: number }>
  potPosition: { left: number; top: number }
  onComplete: () => void
}

const CHIP_COLORS = ['gold', 'purple', 'black', 'green', 'red', 'white']

function createFlyingChip(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  delay: number,
  color: string,
): React.CSSProperties {
  const midX = fromX + (toX - fromX) * 0.5 + (Math.random() - 0.5) * 30
  const midY = fromY + (toY - fromY) * 0.3 + (Math.random() - 0.5) * 20

  return {
    '--from-x': `${fromX}%`,
    '--from-y': `${fromY}%`,
    '--mid-x': `${midX}%`,
    '--mid-y': `${midY}%`,
    '--to-x': `${toX}%`,
    '--to-y': `${toY}%`,
    animationDelay: `${delay}ms`,
    '--chip-color': `var(--chip-${color})`,
  } as React.CSSProperties
}

export default function PotWinAnimation({
  winners,
  seatPositions,
  potPosition,
  onComplete,
}: Props) {
  const [chips, setChips] = useState<Array<{ id: number; style: React.CSSProperties }>>([])
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (winners.length === 0 || seatPositions.size === 0 || !potPosition) return

    const newChips: Array<{ id: number; style: React.CSSProperties }> = []
    let chipId = 0

    winners.forEach((winner) => {
      const seatPos = seatPositions.get(winner.position)
      if (!seatPos) return

      const chipCount = Math.min(Math.max(Math.floor(winner.amount / 50), 3), 12)

      for (let i = 0; i < chipCount; i++) {
        const color = CHIP_COLORS[Math.floor(Math.random() * CHIP_COLORS.length)]
        const delay = i * 80 + Math.random() * 200

        newChips.push({
          id: chipId++,
          style: createFlyingChip(
            potPosition.left,
            potPosition.top,
            seatPos.left,
            seatPos.top,
            delay,
            color,
          ),
        })
      }
    })

    setChips(newChips)

    const maxDelay = Math.max(
      ...newChips.map((c) => parseInt(c.style.animationDelay as string) || 0),
    )
    animationTimeoutRef.current = setTimeout(() => {
      setChips([])
      onComplete()
    }, maxDelay + 1200)

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [winners, seatPositions, potPosition, onComplete])

  if (chips.length === 0) return null

  return (
    <div className="pot-win-animation-overlay">
      {chips.map((chip) => (
        <div key={chip.id} className="flying-chip" style={chip.style} />
      ))}
    </div>
  )
}

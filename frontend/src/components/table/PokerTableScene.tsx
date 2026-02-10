import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { GameState } from './types'
import CommunityCenter from './CommunityCenter'
import PlayerSeat from './PlayerSeat'
import PotWinAnimation, { type WinnerPayout } from './PotWinAnimation'
import './PokerTableScene.css'

type Props = {
  game: GameState
  wsConnected: boolean
  children?: ReactNode
}

function computeSeatStyle(index: number, count: number): { style: CSSProperties; angle: number } {
  const angleOffset = -Math.PI / 2
  const angle = angleOffset + (index / Math.max(count, 1)) * Math.PI * 2

  // Radius in percentage of container size.
  const radius = count <= 4 ? 38 : count <= 6 ? 41 : 44

  const left = 50 + radius * Math.cos(angle)
  const top = 50 + radius * Math.sin(angle)

  return {
    style: {
      left: `${left}%`,
      top: `${top}%`,
    },
    angle,
  }
}

export default function PokerTableScene({ game, wsConnected, children }: Props) {
  const activePlayers = game.players.filter((p) => p.status !== 'out')
  const [animatingWinners, setAnimatingWinners] = useState<WinnerPayout[]>([])
  const previousWinnersRef = useRef<string>('')

  const seatData = useMemo(() => {
    return game.players.map((_, idx) => computeSeatStyle(idx, game.players.length))
  }, [game.players])

  // Build seat positions map for animation
  const seatPositions = useMemo(() => {
    const positions = new Map<number, { left: number; top: number }>()
    game.players.forEach((player, idx) => {
      const { style } = seatData[idx]
      const left = parseFloat(style.left as string)
      const top = parseFloat(style.top as string)
      positions.set(player.position, { left, top })
    })
    return positions
  }, [game.players, seatData])

  // Detect when winners are announced and trigger animation
  useEffect(() => {
    const isShowdown = game.currentRound === 'showdown'
    const hasWinners = game.winners && game.winners.length > 0
    const hasPots = game.pots && game.pots.length > 0

    if (!isShowdown || !hasWinners || !hasPots) {
      setAnimatingWinners([])
      return
    }

    // Create unique key for current winners state
    const winnersKey = `${(game.winners || []).join(',')}-${game.pots?.map((p) => p.amount).join(',')}`

    // Only trigger animation if winners changed
    if (winnersKey === previousWinnersRef.current) return
    previousWinnersRef.current = winnersKey

    // Debug logging
    console.log(
      '[PotWinAnimation] Triggering animation for winners:',
      game.winners,
      'pots:',
      game.pots,
    )

    // Calculate payouts for animation
    const payouts: WinnerPayout[] = []
    game.pots?.forEach((pot) => {
      if (!pot.winners || pot.winners.length === 0) return

      const winAmount = pot.winAmount || Math.floor(pot.amount / pot.winners.length)
      pot.winners.forEach((position) => {
        const player = game.players.find((p) => p.position === position)
        if (player) {
          payouts.push({
            playerId: player.id,
            position,
            amount: winAmount,
            name: player.name,
          })
        }
      })
    })

    if (payouts.length > 0) {
      setAnimatingWinners(payouts)
    }
  }, [game.currentRound, game.winners, game.pots, game.players])

  const handleAnimationComplete = useCallback(() => {
    setAnimatingWinners([])
  }, [])

  const roundLabel = game.currentRound
    ? game.currentRound.charAt(0).toUpperCase() + game.currentRound.slice(1)
    : 'Waiting'

  return (
    <div className="poker-table-page">
      <div className="container-fluid py-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <div className="d-flex align-items-center gap-2">
            <div className="small opacity-75">Room</div>
            <div className="fw-bold">{game.roomCode}</div>
            <span
              className={`badge ${wsConnected ? 'text-bg-success' : 'text-bg-warning'}`}
              title={wsConnected ? 'Connected via WebSocket' : 'Polling fallback'}
            >
              {wsConnected ? 'WS' : 'POLL'}
            </span>
          </div>

          <div className="fw-bold">{roundLabel}</div>

          <div className="small opacity-75">
            Players In: <span className="fw-bold">{activePlayers.length}</span>
          </div>
        </div>

        <div className="ratio ratio-16x9">
          <div className="poker-table-surface">
            <div className="poker-table-inner">
              <CommunityCenter game={game} />

              {game.players.map((player, idx) => {
                const { style, angle } = seatData[idx]
                // Calculate chip position: push towards center
                // Center is at 50,50. Seat is at left,top.
                // We want chips to be placed *in front* of seat.
                // Vector to center is (-cos(angle), -sin(angle))

                // Determine orientation based on 45-degree sectors

                // sin dominates -> Vertical (Top/Bottom)
                // cos dominates -> Horizontal (Left/Right)
                const sin = Math.sin(angle)
                const cos = Math.cos(angle)
                let orientation: 'top' | 'bottom' | 'left' | 'right' = 'bottom'

                if (Math.abs(sin) > Math.abs(cos)) {
                  orientation = sin < 0 ? 'top' : 'bottom'
                } else {
                  orientation = cos > 0 ? 'right' : 'left'
                }

                return (
                  <PlayerSeat
                    key={player.id}
                    game={game}
                    player={player}
                    index={idx}
                    style={style}
                    orientation={orientation}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {children ? <div className="mt-3">{children}</div> : null}
      </div>

      {animatingWinners.length > 0 && (
        <PotWinAnimation
          winners={animatingWinners}
          seatPositions={seatPositions}
          potPosition={{ left: 50, top: 50 }}
          onComplete={handleAnimationComplete}
        />
      )}
    </div>
  )
}

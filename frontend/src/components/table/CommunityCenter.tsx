import type { GameState } from '~/components/table/types'
import { getDisplayPot } from '~/utils/potUtils'
import CountUp from '~/components/CountUp'
import PokerCard from './PokerCard'
import ChipStack from './ChipStack'

type Props = {
  game: GameState
}

export default function CommunityCenter({ game }: Props) {
  const communityCards = game.communityCards || []
  const displayPot = getDisplayPot(game.players, game.pots)
  const isShowdown = game.currentRound === 'showdown'
  const potAnimationKey = `${displayPot}-${game.currentRound}`

  return (
    <div className="poker-table-center">
      <div className="poker-table-community">
        {Array.from({ length: 5 }).map((_, idx) => {
          const card = communityCards[idx]

          if (card) {
            return (
              <PokerCard
                key={idx}
                card={card}
                className="deal-animation large"
                style={{
                  animationDelay: `${idx * 0.08}s`,
                }}
              />
            )
          }

          return (
            <PokerCard
              key={idx}
              hidden
              className="large"
              style={{ opacity: 0.1 }} // subtle ghost placeholder or keep it clear?
              // Actually, previous code used "back" class but maybe we just want empty slots or backs?
              // The previous code rendered "back" for empty slots?
              // Let's re-read the original code.
              // Original code: if (card) { ... } else { className="community-card back" }
              // So it showed backs for future cards? Or placeholders?
              // Usually in poker apps you see empty placeholders or nothing.
              // But if the design expects 5 slots, let's keep it consistent.
              // Wait, standard holdem doesn't show backs for future community cards usually,
              // but maybe the "back" class was just a placeholder.
              // Let's use hidden=true for now, effectively showing a card back.
            />
          )
        })}
      </div>

      <div className="poker-table-pot">
        {isShowdown && game.pots && game.pots.length > 0 ? (
          <div className="pot-display" style={{}}>
            {game.pots.map((pot, idx) => {
              if (!pot.winners || pot.winners.length === 0) return null

              const potLabel =
                game.pots!.length > 1 ? (idx === 0 ? 'Main Pot' : `Side Pot ${idx}`) : 'Winner'

              const winners = game.players.filter((p) => pot.winners!.includes(p.position))
              const winAmount = pot.winAmount || Math.floor(pot.amount / pot.winners.length)

              return (
                <div key={idx} style={{ marginBottom: '8px', padding: '4px' }}>
                  <div className="pot-label" style={{ fontSize: '0.7rem', marginBottom: '2px' }}>
                    {potLabel}
                  </div>
                  {winners.map((winner, wIdx) => (
                    <div key={wIdx} style={{ fontSize: '0.85rem', marginBottom: '2px' }}>
                      <strong>{winner.name}</strong> won <strong>${winAmount}</strong>
                      {pot.winningRankName && (
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                          {pot.winningRankName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="pot-display">
            <div className="pot-label">Pot</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ChipStack amount={displayPot} showAmount={false} />
              <div className="pot-amount">
                <CountUp key={potAnimationKey} end={displayPot} duration={400} prefix="$" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

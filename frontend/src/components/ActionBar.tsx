import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import HorizontalSlider from './HorizontalSlider'
import type { ValidActions } from '@holdem/shared/game-types'
import type { Player } from './table/types'

type Props = {
  validActions: ValidActions | null
  myPlayer: Player | null
  bigBlind: number | undefined
  currentBet: number
  pot: number
  isMyTurn: boolean
  isActing: boolean
  betAmount: number
  raiseAmount: number
  setBetAmount: (n: number) => void
  setRaiseAmount: (n: number) => void
  onAction: (action: string, amount?: number) => void
  showFoldWarning: boolean
  onFoldTap: () => void
  onFoldConfirm: () => void
  onFoldCancel: () => void
}

export default function ActionBar({
  validActions,
  myPlayer,
  bigBlind,
  currentBet,
  pot,
  isMyTurn,
  isActing,
  betAmount,
  raiseAmount,
  setBetAmount,
  setRaiseAmount,
  onAction,
  showFoldWarning,
  onFoldTap,
  onFoldConfirm,
  onFoldCancel,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const canActNow = !!validActions?.canAct && isMyTurn
  const canBetOrRaiseNow = canActNow && (!!validActions?.canBet || !!validActions?.canRaise)

  // Close the drawer whenever betting is no longer available (turn ended, etc.)
  useEffect(() => {
    if (!canBetOrRaiseNow) setDrawerOpen(false)
  }, [canBetOrRaiseNow])

  if (validActions?.canAdvance) {
    return (
      <div className="action-bar">
        <div className="action-advance">
          <div className="action-advance-msg">
            {validActions.advanceReason === 'all_in_situation'
              ? 'All players are All-In. Advance?'
              : 'Ready to advance?'}
          </div>
          <button
            onClick={() => onAction('advance_round')}
            disabled={isActing}
            className="btn-poker btn-poker-primary btn-action-lg w-100"
          >
            <span>{isActing ? 'Advancing...' : 'Advance Round'}</span>
            <span>{isActing ? '⏳' : '⏩'}</span>
          </button>
        </div>
      </div>
    )
  }

  const canAct = !!validActions?.canAct && isMyTurn
  const canFold = !!validActions?.canFold && canAct
  const canCheck = !!validActions?.canCheck && canAct
  const canCall = !!validActions?.canCall && canAct
  const canBet = !!validActions?.canBet && canAct
  const canRaise = !!validActions?.canRaise && canAct
  const canBetOrRaise = canBet || canRaise
  const isRaise = canRaise
  // BB option: currentBet > 0 but callAmount = 0, so canCheck && canRaise.
  // Treat it as a "bet" from the player's perspective — they're adding chips,
  // not re-raising someone else's raise.
  const isBBOption = canCheck && canRaise

  const minVal = isRaise
    ? (validActions?.minRaise ?? bigBlind ?? 10)
    : (validActions?.minBet ?? bigBlind ?? 10)
  const maxVal = isRaise
    ? (validActions?.maxRaise ?? myPlayer?.chips ?? 0)
    : (validActions?.maxBet ?? myPlayer?.chips ?? 0)
  const setVal = isRaise ? setRaiseAmount : setBetAmount
  const currentVal = canBetOrRaise
    ? isRaise
      ? Math.min(Math.max(raiseAmount, minVal), maxVal)
      : Math.min(Math.max(betAmount, minVal), maxVal)
    : (bigBlind ?? 10)
  // For a normal raise, show total wager ("Raise To $60").
  // For BB option, show only the additional chips ("Bet $20").
  const displayAmount = isBBOption ? currentVal : isRaise ? currentBet + currentVal : currentVal
  const betVerb = isBBOption ? 'Bet' : isRaise ? 'Raise To' : 'Bet'

  const callLabel = canCall && !canCheck ? `Call $${validActions?.callAmount ?? 0}` : 'Check'

  const step = bigBlind || 10
  const clamp = (n: number) => Math.min(Math.max(n, minVal), maxVal)
  // Presets target total wager then convert back to raise/bet increment.
  const setFromTotal = (targetTotal: number) =>
    setVal(clamp(isRaise ? targetTotal - currentBet : targetTotal))

  const presets: { label: string; onClick: () => void }[] = [
    { label: '½ Pot', onClick: () => setFromTotal(Math.round(pot * 0.5)) },
    { label: '¾ Pot', onClick: () => setFromTotal(Math.round(pot * 0.75)) },
    { label: 'Pot', onClick: () => setFromTotal(pot) },
    { label: 'All-In', onClick: () => setVal(maxVal) },
  ]

  const accent = isRaise ? '#ffc107' : '#0dcaf0'

  const confirmBet = () => {
    if (!canBetOrRaise) return
    onAction(isRaise ? 'raise' : 'bet', currentVal)
    setDrawerOpen(false)
  }

  return (
    <div className="action-bar">
      {showFoldWarning &&
        canCheck &&
        createPortal(
          <div className="fold-confirm-backdrop" onClick={onFoldConfirm} role="presentation">
            <div className="fold-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="fold-confirm-icon">✕</div>
              <div className="fold-confirm-title">Fold for free?</div>
              <div className="fold-confirm-body">You can check — no need to fold.</div>
              <div className="fold-confirm-actions">
                <button
                  onClick={onFoldConfirm}
                  disabled={isActing}
                  className="btn-poker btn-poker-primary btn-action-lg flex-grow-1"
                >
                  <span>Check instead</span>
                  <span>✓</span>
                </button>
                <button
                  onClick={onFoldCancel}
                  disabled={isActing}
                  className="btn-poker btn-poker-danger btn-action-lg"
                >
                  Fold anyway
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {
        <div className="action-row">
          <button
            onClick={onFoldTap}
            disabled={isActing || !canFold}
            className="btn-poker btn-poker-danger btn-action-lg flex-grow-1"
            style={{ opacity: canFold ? 1 : 0.35 }}
          >
            <span>{isActing ? 'Folding...' : 'Fold'}</span>
            <span>{isActing ? '⏳' : '✕'}</span>
          </button>

          <button
            onClick={() => (canCheck ? onAction('check') : canCall ? onAction('call') : null)}
            disabled={isActing || !(canCheck || canCall)}
            className="btn-poker btn-poker-primary btn-action-lg flex-grow-1"
            style={{ opacity: canCheck || canCall ? 1 : 0.35 }}
          >
            <span>
              {isActing ? (canCall && !canCheck ? 'Calling...' : 'Checking...') : callLabel}
            </span>
            <span>{isActing ? '⏳' : '✓'}</span>
          </button>

          {canBetOrRaise && (
            <button
              onClick={() => setDrawerOpen(true)}
              disabled={isActing}
              className={`btn-poker ${isRaise ? 'btn-poker-secondary' : 'btn-poker-info'} btn-action-lg flex-grow-1`}
            >
              <span>{isRaise ? 'Raise' : 'Bet'}</span>
              <span>⏶</span>
            </button>
          )}
        </div>
      }

      {drawerOpen && canBetOrRaise && (
        <div
          className="bet-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          role="presentation"
        >
          <div className="bet-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="bet-drawer-handle" />

            <div className="bet-drawer-header">
              <span className="bet-drawer-label">{betVerb}</span>
              <span className="bet-drawer-amount" style={{ color: accent }}>
                ${displayAmount}
              </span>
            </div>

            <div className="bet-drawer-slider-row">
              <button
                className="btn-chip chip-minus"
                onClick={() => setVal(clamp(currentVal - step))}
                disabled={isActing}
              >
                −
              </button>
              <HorizontalSlider
                value={currentVal}
                min={minVal}
                max={maxVal}
                step={1}
                onChange={setVal}
                thumbColor={accent}
                trackColor="rgba(255,255,255,0.1)"
              />
              <button
                className="btn-chip chip-plus"
                onClick={() => setVal(clamp(currentVal + step))}
                disabled={isActing}
              >
                +
              </button>
            </div>

            <div className="bet-drawer-range">
              <span>MIN ${minVal}</span>
              <span>MAX ${maxVal}</span>
            </div>

            <div className="bet-drawer-presets">
              {presets.map((p) => (
                <button
                  key={p.label}
                  className="bet-preset"
                  onClick={p.onClick}
                  disabled={isActing}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="bet-drawer-actions">
              <button
                onClick={() => setDrawerOpen(false)}
                disabled={isActing}
                className="btn-poker btn-poker-ghost btn-action-lg flex-grow-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmBet}
                disabled={isActing}
                className={`btn-poker ${isRaise ? 'btn-poker-secondary' : 'btn-poker-info'} btn-action-lg flex-grow-1`}
              >
                {isActing ? 'Processing...' : `${betVerb} $${displayAmount}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {!canAct && !showFoldWarning && validActions?.canAdvance === undefined && (
        <div className="action-status">
          {myPlayer?.status === 'folded' ? (
            <span className="text-danger">Folded — waiting for next hand</span>
          ) : (
            <span className="text-secondary d-inline-flex align-items-center gap-2">
              <span className="spinner-border spinner-border-sm"></span>
              <span>Waiting for action...</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

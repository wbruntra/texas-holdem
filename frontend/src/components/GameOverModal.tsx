import type { GameState } from '~/components/table/types'

interface GameOverModalProps {
  game: GameState
  isOpen: boolean
  onClose: () => void
  onResetGame?: () => void
  isResetting?: boolean
}

export default function GameOverModal({
  game,
  isOpen,
  onClose,
  onResetGame,
  isResetting = false,
}: GameOverModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)', zIndex: 1100 }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div
          className="modal-content bg-dark text-white border-warning shadow-lg p-4"
          style={{ border: '2px solid gold' }}
        >
          <button
            onClick={onClose}
            className="btn-close btn-close-white position-absolute top-0 end-0 m-3 p-3"
            aria-label="Close"
          ></button>

          <div className="modal-body text-center p-4">
            <div className="display-1 mb-3">🏆</div>
            <h2 className="display-6 fw-bold text-warning mb-4">GAME OVER!</h2>

            <p className="small text-secondary mb-4 uppercase text-uppercase fw-bold">
              Final Chip Count
            </p>

            <div className="d-flex flex-column gap-2 mb-5">
              {[...game.players]
                .sort((a, b) => b.chips - a.chips)
                .map((player) => (
                  <div
                    key={player.name}
                    className={`d-flex justify-content-between p-3 rounded border ${
                      player.chips > 0
                        ? 'bg-success bg-opacity-10 border-success text-success'
                        : 'bg-danger bg-opacity-10 border-danger text-secondary'
                    }`}
                  >
                    <span className="fw-bold">{player.name}</span>
                    <span className="fw-bold">${player.chips}</span>
                  </div>
                ))}
            </div>

            <div className="d-flex gap-2 justify-content-center mt-4">
              <button onClick={onClose} className="btn-poker btn-poker-outline px-4">
                Close
              </button>

              {onResetGame && (
                <button
                  onClick={onResetGame}
                  disabled={isResetting}
                  className="btn-poker btn-poker-secondary px-4"
                >
                  {isResetting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Resetting...
                    </>
                  ) : (
                    <>🔄 Start New Game</>
                  )}
                </button>
              )}
            </div>

            <div className="small text-secondary border-top border-secondary pt-3 mt-2">
              Room: <span className="text-light">{game.roomCode}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

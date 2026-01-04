import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '~/store/hooks'
import {
  checkAuth,
  joinGame as joinGameThunk,
  startGame as startGameThunk,
  performAction as performActionThunk,
  nextHand as nextHandThunk,
  revealCard as revealCardThunk,
  advanceRound as advanceRoundThunk,
  toggleShowCards as toggleShowCardsThunk,
  fetchValidActions as fetchValidActionsThunk,
  setPlayerName,
  setBetAmount,
  setRaiseAmount,
  setError,
  clearValidActions,
} from '~/store/playerSlice'
import { setGame, setWsConnected } from '~/store/gameSlice'
import { WebSocketManager } from '~/lib/WebSocketManager'
import type { GameState, Player } from '~/components/table/types'

export function usePlayerGame(roomCode: string | undefined) {
  const dispatch = useAppDispatch()

  const validActions = useAppSelector((state) => state.player.validActions)
  const playerName = useAppSelector((state) => state.player.playerName)
  const joined = useAppSelector((state) => state.player.joined)
  const error = useAppSelector((state) => state.player.error)
  const checkingAuth = useAppSelector((state) => state.player.checkingAuth)
  const betAmount = useAppSelector((state) => state.player.betAmount)
  const raiseAmount = useAppSelector((state) => state.player.raiseAmount)
  const game = useAppSelector((state) => state.game.game)

  const wsManagerRef = useRef<WebSocketManager | null>(null)
  const playerNameRef = useRef(playerName)

  useEffect(() => {
    playerNameRef.current = playerName
  }, [playerName])

  const playerNameStorageKey = roomCode ? `holdem:${roomCode}:playerName` : null

  const updateValidActions = async (nextGame: GameState) => {
    const myName = playerNameRef.current
    const me = myName ? nextGame.players.find((p: Player) => p.name === myName) : undefined

    const isMyTurnNow =
      !!me &&
      nextGame.status === 'active' &&
      nextGame.currentPlayerPosition !== null &&
      nextGame.currentPlayerPosition === (me?.position ?? -1)

    const canAdvance =
      nextGame.action_finished === true ||
      (nextGame.status === 'active' &&
        nextGame.currentRound !== 'showdown' &&
        nextGame.currentPlayerPosition === null)

    if ((isMyTurnNow || canAdvance) && nextGame.id) {
      await dispatch(fetchValidActionsThunk(String(nextGame.id)))
    } else {
      dispatch(clearValidActions())
    }
  }

  useEffect(() => {
    if (!roomCode) return

    const loadStoredName = () => {
      if (playerNameStorageKey) {
        const storedName = localStorage.getItem(playerNameStorageKey)
        if (storedName) {
          dispatch(setPlayerName(storedName))
        }
      }
    }

    loadStoredName()

    const performCheckAuth = async () => {
      const result = await dispatch(checkAuth({ roomCode, playerNameStorageKey }))
      if (checkAuth.fulfilled.match(result)) {
        dispatch(setGame(result.payload.game))
      }
    }

    performCheckAuth()
  }, [roomCode, playerNameStorageKey, dispatch])

  useEffect(() => {
    if (!joined || !game?.id || !roomCode) return

    const storedPlayerId = playerNameStorageKey
      ? localStorage.getItem(`${playerNameStorageKey}:playerId`)
      : undefined

    wsManagerRef.current = new WebSocketManager({
      onHello: (payload) => {
        console.log('[usePlayerGame] Server hello:', payload)
        dispatch(setError(''))
      },
      onSubscribed: () => {
        console.log('[usePlayerGame] Subscribed to player stream')
      },
      onGameState: (payload) => {
        const nextGame = payload.state as GameState
        dispatch(setGame(nextGame))
        dispatch(setError(''))
        updateValidActions(nextGame)
      },
      onError: (err) => {
        console.error('[usePlayerGame] WebSocket error:', err)
        dispatch(setError(err))
      },
    })

    wsManagerRef.current.connect(roomCode, 'player', game.id, storedPlayerId ?? undefined)

    return () => {
      wsManagerRef.current?.disconnect()
      wsManagerRef.current = null
    }
  }, [joined, game?.id, roomCode, playerNameStorageKey, dispatch])

  useEffect(() => {
    if (wsManagerRef.current) {
      const isConnected = wsManagerRef.current.isConnected()
      dispatch(setWsConnected(isConnected))
    }
  }, [wsManagerRef.current, dispatch])

  const handleJoinGame = async (password: string) => {
    if (!roomCode || !playerName.trim() || !password.trim()) return
    const result = await dispatch(joinGameThunk({ roomCode, playerName, password }))
    if (joinGameThunk.fulfilled.match(result)) {
      dispatch(setGame(result.payload.game))
    }
  }

  const handleStartGame = async () => {
    if (!game?.id) return
    dispatch(startGameThunk(game.id))
  }

  const handlePerformAction = async (action: string, amount?: number) => {
    if (!game?.id) return
    dispatch(performActionThunk({ gameId: game.id, action, amount }))
  }

  const handleNextHand = async () => {
    if (!game?.id) return
    dispatch(nextHandThunk(game.id))
  }

  const handleRevealCard = async () => {
    if (!game?.id) return
    dispatch(revealCardThunk(game.id))
  }

  const handleAdvanceRound = async () => {
    if (!game?.id) return
    dispatch(advanceRoundThunk(game.id))
  }

  const handleToggleShowCards = async (showCards: boolean) => {
    if (!game?.id) return
    dispatch(toggleShowCardsThunk({ gameId: game.id, showCards }))
  }

  const handleSetPlayerName = (name: string) => {
    dispatch(setPlayerName(name))
    if (playerNameStorageKey && name) {
      localStorage.setItem(playerNameStorageKey, name)
    }
  }

  const handleSetBetAmount = (amount: number) => {
    dispatch(setBetAmount(amount))
  }

  const handleSetRaiseAmount = (amount: number) => {
    dispatch(setRaiseAmount(amount))
  }

  return {
    game,
    validActions,
    playerName,
    setPlayerName: handleSetPlayerName,
    joined,
    error,
    checkingAuth,
    wsConnected: wsManagerRef.current?.isConnected() ?? false,
    betAmount,
    raiseAmount,
    joinGame: handleJoinGame,
    startGame: handleStartGame,
    performAction: handlePerformAction,
    nextHand: handleNextHand,
    revealCard: handleRevealCard,
    advanceRound: handleAdvanceRound,
    toggleShowCards: handleToggleShowCards,
    setBetAmount: handleSetBetAmount,
    setRaiseAmount: handleSetRaiseAmount,
  }
}

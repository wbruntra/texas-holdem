import { useEffect, useRef } from 'react'
import axios from 'axios'
import { BACKEND_LOCAL_PORT } from '@holdem/shared/config'
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
  setCanRevealCard,
  setWsConnected,
  setError,
  clearValidActions,
} from '~/store/playerSlice'
import { setGame } from '~/store/gameSlice'
import type { GameState, Player } from '~/components/table/types'

export function usePlayerGame(roomCode: string | undefined) {
  const dispatch = useAppDispatch()

  const validActions = useAppSelector((state) => state.player.validActions)
  const playerName = useAppSelector((state) => state.player.playerName)
  const joined = useAppSelector((state) => state.player.joined)
  const error = useAppSelector((state) => state.player.error)
  const checkingAuth = useAppSelector((state) => state.player.checkingAuth)
  const canRevealCard = useAppSelector((state) => state.player.canRevealCard)
  const wsConnected = useAppSelector((state) => state.player.wsConnected)
  const betAmount = useAppSelector((state) => state.player.betAmount)
  const raiseAmount = useAppSelector((state) => state.player.raiseAmount)
  const game = useAppSelector((state) => state.game.game)

  const joinedRef = useRef(joined)
  joinedRef.current = joined

  const gameIdRef = useRef<string | undefined>(game?.id)
  gameIdRef.current = game?.id

  const playerNameRef = useRef(playerName)
  playerNameRef.current = playerName

  const playerNameStorageKey = roomCode ? `holdem:${roomCode}:playerName` : null

  const checkCanRevealCard = (gameState: GameState, myPlayerName: string | null): boolean => {
    if (!myPlayerName || gameState.status !== 'active') {
      return false
    }

    if (
      !gameState.currentRound ||
      gameState.currentRound === 'preflop' ||
      gameState.currentRound === 'showdown'
    ) {
      return false
    }

    const playersWithChips = gameState.players.filter(
      (p: { chips: number; status: string }) =>
        p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
    )

    if (playersWithChips.length !== 1) {
      return false
    }

    const allInPlayers = gameState.players.filter((p: { status: string }) => p.status === 'all_in')
    if (allInPlayers.length === 0) {
      return false
    }

    const myPlayer = gameState.players.find((p: { name: string }) => p.name === myPlayerName)
    return (myPlayer?.chips ?? 0) > 0
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

    const gameId = game.id
    let ws: WebSocket | null = null
    let pollInterval: number | null = null
    let reconnectTimeout: number | null = null

    const fetchValidActions = async (gid: string) => {
      try {
        dispatch(fetchValidActionsThunk(gid))
      } catch (err) {
        if (!axios.isAxiosError(err) || err.response?.status !== 403) {
          console.error('[PlayerView] Failed to fetch valid actions:', err)
        }
      }
    }

    const startPolling = () => {
      const tick = async () => {
        try {
          const response = await axios.get(`/api/games/${gameId}`, {
            withCredentials: true,
          })

          const nextGame: GameState = response.data
          dispatch(setGame(nextGame))

          const myName = playerNameRef.current
          const me = myName ? nextGame.players.find((p: Player) => p.name === myName) : undefined

          const isMyTurnNow =
            !!me &&
            nextGame.status === 'active' &&
            nextGame.currentPlayerPosition !== null &&
            nextGame.currentPlayerPosition === (me?.position ?? -1)

          const canReveal = checkCanRevealCard(nextGame, myName)
          dispatch(setCanRevealCard(canReveal))

          if (isMyTurnNow) {
            await fetchValidActions(gameId)
          } else {
            dispatch(clearValidActions())
          }

          dispatch(setError(''))
        } catch (err: unknown) {
          if (!(axios.isAxiosError(err) && err.response?.status === 403)) {
            dispatch(setError('Failed to load game'))
          }
        }
      }

      tick()
      pollInterval = window.setInterval(tick, 1500)
    }

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const isDevelopment =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const wsUrl = isDevelopment
        ? `${protocol}//localhost:${BACKEND_LOCAL_PORT}/ws`
        : `${protocol}//${window.location.host}/ws`

      console.log('[PlayerView] Connecting to WebSocket:', wsUrl)
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[PlayerView] WebSocket connected')
        dispatch(setWsConnected(true))
        dispatch(setError(''))

        if (ws && ws.readyState === WebSocket.OPEN) {
          const storedPlayerId = playerNameStorageKey
            ? localStorage.getItem(`${playerNameStorageKey}:playerId`)
            : null

          ws.send(
            JSON.stringify({
              type: 'subscribe',
              payload: {
                roomCode,
                stream: 'player',
                gameId,
                playerId: storedPlayerId,
              },
            }),
          )
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'hello':
              console.log('[PlayerView] Server hello:', message.payload)
              break

            case 'subscribed':
              console.log('[PlayerView] Subscribed to player stream')
              if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
              }
              break

            case 'game_state':
              const nextGame: GameState = message.payload.state
              dispatch(setGame(nextGame))

              const myName = playerNameRef.current
              const me = myName
                ? nextGame.players.find((p: Player) => p.name === myName)
                : undefined

              const isMyTurnNow =
                !!me &&
                nextGame.status === 'active' &&
                nextGame.currentPlayerPosition !== null &&
                nextGame.currentPlayerPosition === (me?.position ?? -1)

              const canReveal = checkCanRevealCard(nextGame, myName)
              dispatch(setCanRevealCard(canReveal))

              if (isMyTurnNow) {
                fetchValidActions(gameId)
              } else {
                dispatch(clearValidActions())
              }

              dispatch(setError(''))
              break

            case 'error':
              console.error('[PlayerView] WebSocket error:', message.payload.error)
              dispatch(setError(message.payload.error))
              break
          }
        } catch (err) {
          console.error('[PlayerView] Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = () => {
        console.error('[PlayerView] WebSocket error')
        dispatch(setWsConnected(false))
      }

      ws.onclose = () => {
        console.log('[PlayerView] WebSocket disconnected')
        dispatch(setWsConnected(false))

        if (!pollInterval) {
          startPolling()
        }

        reconnectTimeout = window.setTimeout(() => {
          console.log('[PlayerView] Attempting to reconnect...')
          connectWebSocket()
        }, 3000)
      }
    }

    connectWebSocket()

    return () => {
      if (ws) ws.close()
      if (pollInterval) clearInterval(pollInterval)
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [joined, game?.id, roomCode, playerNameStorageKey, dispatch])

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
    canRevealCard,
    wsConnected,
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

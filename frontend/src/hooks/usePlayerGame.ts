import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { BACKEND_LOCAL_PORT } from '@scaffold/shared/config'

export interface Player {
  id: string
  name: string
  position: number
  chips: number
  currentBet: number
  status: string
  holeCards?: Array<{ rank: string; suit: string }>
}

export interface Pot {
  amount: number
  eligiblePlayers: number[]
  winners?: number[] | null
}

export interface GameState {
  id: string
  roomCode: string
  status: string
  currentRound: string
  pot: number
  pots?: Pot[]
  currentBet: number
  currentPlayerPosition: number | null
  communityCards: Array<{ rank: string; suit: string }>
  players: Player[]
  dealerPosition: number
  winners?: number[]
  bigBlind?: number
}

export interface ValidActions {
  canAct: boolean
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  callAmount?: number
  canBet: boolean
  minBet?: number
  maxBet?: number
  canRaise: boolean
  minRaise?: number
  maxRaise?: number
}

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (!axios.isAxiosError(err)) return fallback
  const data = err.response?.data as { error?: string } | undefined
  return data?.error || fallback
}

export function usePlayerGame(roomCode: string | undefined) {
  const [game, setGame] = useState<GameState | null>(null)
  const [validActions, setValidActions] = useState<ValidActions | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [canRevealCard, setCanRevealCard] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)

  // We use refs to access the latest state in closures/intervals without triggering re-renders
  // or needing them in dependency arrays which would cause recocnnections
  const joinedRef = useRef(joined)
  joinedRef.current = joined

  const gameIdRef = useRef<string | undefined>(game?.id)
  gameIdRef.current = game?.id

  const playerNameRef = useRef(playerName)
  playerNameRef.current = playerName

  const playerNameStorageKey = roomCode ? `holdem:${roomCode}:playerName` : null

  // Check Helper
  const checkCanRevealCard = (gameState: GameState, myPlayerName: string | null) => {
    if (!myPlayerName || gameState.status !== 'active') {
      return false
    }

    // Can't reveal in preflop or showdown
    if (
      !gameState.currentRound ||
      gameState.currentRound === 'preflop' ||
      gameState.currentRound === 'showdown'
    ) {
      return false
    }

    // Count players with chips
    const playersWithChips = gameState.players.filter(
      (p) => p.chips > 0 && p.status !== 'out' && p.status !== 'folded',
    )

    // Can only reveal if I'm the only one with chips
    if (playersWithChips.length !== 1) {
      return false
    }

    // Must be that player
    const myPlayer = gameState.players.find((p) => p.name === myPlayerName)
    return (myPlayer?.chips ?? 0) > 0
  }

  // Check for existing authentication on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      if (!roomCode) {
        setCheckingAuth(false)
        return
      }

      // Prefill name from localStorage
      if (playerNameStorageKey) {
        const storedName = localStorage.getItem(playerNameStorageKey)
        if (storedName && !playerName) {
          setPlayerName(storedName)
        }
      }

      try {
        // Get game info
        const gameResponse = await axios.get(`/api/games/room/${roomCode}`)
        const gameId = gameResponse.data.id

        // Try to fetch game state with credentials
        const stateResponse = await axios.get(`/api/games/${gameId}`, {
          withCredentials: true,
        })

        // Authenticated!
        setGame(stateResponse.data)
        setJoined(true)

        // Infer name if needed
        if (!playerNameStorageKey || !localStorage.getItem(playerNameStorageKey)) {
          const authenticatedPlayer = stateResponse.data.players.find(
            (p: Player) => p.holeCards && p.holeCards.length > 0,
          )
          if (authenticatedPlayer) {
            setPlayerName(authenticatedPlayer.name)
            if (playerNameStorageKey) {
              localStorage.setItem(playerNameStorageKey, authenticatedPlayer.name)
            }
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setCheckingAuth(false)
      }
    }

    checkExistingAuth()
  }, [roomCode, playerNameStorageKey])

  // WebSocket / Polling
  useEffect(() => {
    if (!joined || !game?.id || !roomCode) return

    const gameId = game.id
    let ws: WebSocket | null = null
    let pollInterval: number | null = null
    let reconnectTimeout: number | null = null

    const fetchValidActions = async (gid: string) => {
      try {
        const actionsResponse = await axios.get(`/api/games/${gid}/actions/valid`, {
          withCredentials: true,
        })
        setValidActions(actionsResponse.data)
      } catch (err: unknown) {
        if (!(axios.isAxiosError(err) && err.response?.status === 403)) {
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
          setGame(nextGame)

          const myName = playerNameRef.current
          const me = myName ? nextGame.players.find((p) => p.name === myName) : undefined

          const isMyTurnNow =
            !!me &&
            nextGame.status === 'active' &&
            nextGame.currentPlayerPosition !== null &&
            nextGame.currentPlayerPosition === (me?.position ?? -1)

          const canReveal = checkCanRevealCard(nextGame, myName)
          setCanRevealCard(canReveal)

          if (isMyTurnNow) {
            await fetchValidActions(gameId)
          } else {
            setValidActions((prev) => (prev ? null : prev))
          }

          setError('')
        } catch (err: unknown) {
          if (!(axios.isAxiosError(err) && err.response?.status === 403)) {
            setError(getApiErrorMessage(err, 'Failed to load game'))
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
        setWsConnected(true)
        setError('')

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
              setGame(nextGame)

              const myName = playerNameRef.current
              const me = myName ? nextGame.players.find((p) => p.name === myName) : undefined

              const isMyTurnNow =
                !!me &&
                nextGame.status === 'active' &&
                nextGame.currentPlayerPosition !== null &&
                nextGame.currentPlayerPosition === (me?.position ?? -1)

              const canReveal = checkCanRevealCard(nextGame, myName)
              setCanRevealCard(canReveal)

              if (isMyTurnNow) {
                fetchValidActions(gameId)
              } else {
                setValidActions((prev) => (prev ? null : prev))
              }

              setError('')
              break

            case 'error':
              console.error('[PlayerView] WebSocket error:', message.payload.error)
              setError(message.payload.error)
              break
          }
        } catch (err) {
          console.error('[PlayerView] Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('[PlayerView] WebSocket error:', error)
        setWsConnected(false)
      }

      ws.onclose = () => {
        console.log('[PlayerView] WebSocket disconnected')
        setWsConnected(false)

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
  }, [joined, game?.id, roomCode, playerNameStorageKey])
  // Note: we don't include playerName in deps because we use ref.
  // But wait, the original code DID include playerName.
  // Including playerName causes reconnection when name changes (which happens once on load).
  // Using ref allows us to access current key without reconnecting, but the Original code reconnects.
  // Actually, once joined, name shouldn't change.
  // Let's stick to the original deps to be safe, but we moved checkingAuth to a separate effect.
  // Original deps: [joined, game?.id, roomCode, playerName]
  // We can include playerName if we want, but joined is the trigger.

  const joinGame = async (password: string) => {
    if (!roomCode || !playerName.trim() || !password.trim()) return

    try {
      const gameResponse = await axios.get(`/api/games/room/${roomCode}`)
      const gameId = gameResponse.data.id
      const gameData = gameResponse.data

      const playerExists = gameData.players?.some((p: Player) => p.name === playerName.trim())

      if (playerExists) {
        await axios.post(
          `/api/games/${gameId}/auth`,
          { name: playerName.trim(), password },
          { withCredentials: true },
        )
      } else {
        await axios.post(
          `/api/games/${gameId}/join`,
          { name: playerName.trim(), password },
          { withCredentials: true },
        )
      }

      if (playerNameStorageKey) {
        localStorage.setItem(playerNameStorageKey, playerName.trim())
      }

      const stateResponse = await axios.get(`/api/games/${gameId}`, {
        withCredentials: true,
      })

      setGame(stateResponse.data)

      const authenticatedPlayer = stateResponse.data.players.find(
        (p: Player) => p.holeCards && p.holeCards.length > 0,
      )
      if (authenticatedPlayer && playerNameStorageKey) {
        localStorage.setItem(`${playerNameStorageKey}:playerId`, authenticatedPlayer.id)
      }

      setJoined(true)
      setError('')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to join game'))
    }
  }

  const startGame = async () => {
    if (!game?.id) return
    try {
      await axios.post(`/api/games/${game.id}/start`, {}, { withCredentials: true })
      setError('')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to start game'))
    }
  }

  const performAction = async (action: string, amount?: number) => {
    if (!game?.id) return
    try {
      await axios.post(
        `/api/games/${game.id}/actions`,
        { action, amount },
        { withCredentials: true },
      )
      setError('')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to submit action'))
    }
  }

  const nextHand = async () => {
    if (!game?.id) return
    try {
      const res = await axios.post(
        `/api/games/${game.id}/next-hand`,
        {},
        { withCredentials: true },
      )
      setGame(res.data)
      setError('')
      setValidActions(null)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to start next hand'))
    }
  }

  const revealCard = async () => {
    if (!game?.id) return
    try {
      const res = await axios.post(
        `/api/games/${game.id}/reveal-card`,
        {},
        { withCredentials: true },
      )
      setGame(res.data)
      setError('')
      setCanRevealCard(false)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to reveal card'))
    }
  }

  const advanceRound = async () => {
    if (!game?.id) return
    try {
      const res = await axios.post(`/api/games/${game.id}/advance`, {}, { withCredentials: true })
      setGame(res.data)
      setError('')
      setValidActions(null)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to advance round'))
    }
  }

  return {
    game,
    validActions,
    playerName,
    setPlayerName,
    joined,
    error,
    checkingAuth,
    canRevealCard,
    wsConnected,
    joinGame,
    startGame,
    performAction,
    nextHand,
    revealCard,
    advanceRound,
  }
}

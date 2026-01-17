import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import axios from 'axios'
import type { GameState } from '../components/table/types'
import type { ValidActions } from '@holdem/shared/game-types'

interface PlayerState {
  validActions: ValidActions | null
  playerName: string
  joined: boolean
  checkingAuth: boolean
  canRevealCard: boolean
  wsConnected: boolean
  betAmount: number
  raiseAmount: number
  error: string
  token: string | null
}

const initialState: PlayerState = {
  validActions: null,
  playerName: '',
  joined: false,
  checkingAuth: true,
  canRevealCard: false,
  wsConnected: false,
  betAmount: 0,
  raiseAmount: 0,
  error: '',
  token: null,
}

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (!axios.isAxiosError(err)) return fallback
  const data = err.response?.data as { error?: string } | undefined
  const error = data?.error || fallback

  if (error === 'Invalid password') {
    return 'Incorrect password for this room'
  }
  if (error === 'Game already started') {
    return 'Cannot join: game has already started'
  }
  if (error === 'Game is full') {
    return 'Cannot join: game is full'
  }
  if (error === 'Game not found') {
    return 'Game not found'
  }
  return error
}

const getAuthHeader = (token: string | null) => {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const checkAuth = createAsyncThunk(
  'player/checkAuth',
  async (
    { roomCode, playerNameStorageKey }: { roomCode: string; playerNameStorageKey: string | null },
    { rejectWithValue },
  ) => {
    try {
      // 1. Check for stored token
      const storedTokenKey = `holdem:${roomCode}:token`
      const token = localStorage.getItem(storedTokenKey)

      if (!token) {
        throw new Error('No token found')
      }

      // 2. Get active game (public info)
      const gameResponse = await axios.get(`/api/games/room/${roomCode}`)
      const gameId = gameResponse.data.id

      // 3. Get game state WITH stored token to verify it works
      const stateResponse = await axios.get(`/api/games/${gameId}`, {
        headers: getAuthHeader(token),
      })

      // Try to confirm player identity from game state if possible, otherwise rely on local storage name
      // const authenticatedPlayer = stateResponse.data.players.find(...)

      let myName = ''
      if (playerNameStorageKey) {
        myName = localStorage.getItem(playerNameStorageKey) || ''
      }

      return {
        game: stateResponse.data,
        playerName: myName,
        token,
      }
    } catch {
      return rejectWithValue('Not authenticated')
    }
  },
)

export const joinGame = createAsyncThunk(
  'player/joinGame',
  async (
    { roomCode, playerName, password }: { roomCode: string; playerName: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      // 1. Join Room (Auth)
      // Note: Backend expects raw password now (I updated room-service)
      const roomResponse = await axios.post(`/api/rooms/${roomCode}/join`, {
        name: playerName,
        password: password,
      })

      const { player: roomPlayer, token } = roomResponse.data

      // Store token
      const storedTokenKey = `holdem:${roomCode}:token`
      localStorage.setItem(storedTokenKey, token)

      if (roomPlayer && roomPlayer.name) {
        localStorage.setItem(`holdem:${roomCode}:playerName`, roomPlayer.name)
      }

      // 2. Get active game
      const gameResponse = await axios.get(`/api/games/room/${roomCode}`)
      const gameId = gameResponse.data.id

      // 3. Join Game (Sit at table)
      // This creates a game_player entry if not exists
      await axios.post(
        `/api/games/${gameId}/join`,
        {}, // Body is empty now as we auth via token
        { headers: getAuthHeader(token) },
      )

      // 4. Get full game state
      const stateResponse = await axios.get(`/api/games/${gameId}`, {
        headers: getAuthHeader(token),
      })

      return {
        game: stateResponse.data,
        playerName: roomPlayer.name,
        token,
      }
    } catch (err: unknown) {
      return rejectWithValue(getApiErrorMessage(err, 'Failed to join game'))
    }
  },
)

export const startGame = createAsyncThunk(
  'player/startGame',
  async (gameId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { player: PlayerState }
      await axios.post(
        `/api/games/${gameId}/start`,
        {},
        { headers: getAuthHeader(state.player.token) },
      )
      return ''
    } catch (err: unknown) {
      return rejectWithValue(getApiErrorMessage(err, 'Failed to start game'))
    }
  },
)

export const performAction = createAsyncThunk(
  'player/performAction',
  async (
    { gameId, action, amount }: { gameId: string; action: string; amount?: number },
    { rejectWithValue, getState },
  ) => {
    try {
      const state = getState() as { player: PlayerState }
      await axios.post(
        `/api/games/${gameId}/actions`,
        { action, amount },
        { headers: getAuthHeader(state.player.token) },
      )
      return ''
    } catch (err: unknown) {
      return rejectWithValue(getApiErrorMessage(err, 'Failed to submit action'))
    }
  },
)

export const nextHand = createAsyncThunk(
  'player/nextHand',
  async (gameId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { player: PlayerState }
      const res = await axios.post(
        `/api/games/${gameId}/next-hand`,
        {},
        { headers: getAuthHeader(state.player.token) },
      )
      return res.data as GameState
    } catch (err: unknown) {
      return rejectWithValue(getApiErrorMessage(err, 'Failed to start next hand'))
    }
  },
)

export const revealCard = createAsyncThunk(
  'player/revealCard',
  async (gameId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { player: PlayerState }
      const res = await axios.post(
        `/api/games/${gameId}/reveal-card`,
        {},
        { headers: getAuthHeader(state.player.token) },
      )
      return res.data as GameState
    } catch (err: unknown) {
      return rejectWithValue(getApiErrorMessage(err, 'Failed to reveal card'))
    }
  },
)

export const advanceRound = createAsyncThunk(
  'player/advanceRound',
  async (gameId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { player: PlayerState }
      const res = await axios.post(
        `/api/games/${gameId}/advance`,
        {},
        { headers: getAuthHeader(state.player.token) },
      )
      return res.data as GameState
    } catch (err: unknown) {
      return rejectWithValue(getApiErrorMessage(err, 'Failed to advance round'))
    }
  },
)

export const toggleShowCards = createAsyncThunk(
  'player/toggleShowCards',
  async (
    { gameId, showCards }: { gameId: string; showCards: boolean },
    { rejectWithValue, getState },
  ) => {
    try {
      const state = getState() as { player: PlayerState }
      await axios.post(
        `/api/games/${gameId}/show-cards`,
        { showCards },
        { headers: getAuthHeader(state.player.token) },
      )
      return ''
    } catch (err: unknown) {
      return rejectWithValue(getApiErrorMessage(err, 'Failed to toggle card reveal'))
    }
  },
)

export const fetchValidActions = createAsyncThunk(
  'player/fetchValidActions',
  async (gameId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { player: PlayerState }
      const response = await axios.get(`/api/games/${gameId}/actions/valid`, {
        headers: getAuthHeader(state.player.token),
      })
      return response.data as ValidActions
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        return rejectWithValue('Forbidden')
      }
      return rejectWithValue(getApiErrorMessage(err, 'Failed to fetch valid actions'))
    }
  },
)

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setPlayerName: (state, action: PayloadAction<string>) => {
      state.playerName = action.payload
    },
    setBetAmount: (state, action: PayloadAction<number>) => {
      state.betAmount = action.payload
    },
    setRaiseAmount: (state, action: PayloadAction<number>) => {
      state.raiseAmount = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
    },
    setWsConnected: (state, action: PayloadAction<boolean>) => {
      state.wsConnected = action.payload
    },
    setCanRevealCard: (state, action: PayloadAction<boolean>) => {
      state.canRevealCard = action.payload
    },
    clearValidActions: (state) => {
      state.validActions = null
    },
    initializeBettingAmounts: (state, action: PayloadAction<ValidActions>) => {
      const actions = action.payload
      if (actions.canBet && actions.minBet !== undefined) {
        state.betAmount = actions.minBet
      }
      if (actions.canRaise && actions.minRaise !== undefined) {
        state.raiseAmount = actions.minRaise
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.pending, (state) => {
        state.checkingAuth = true
        state.error = ''
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.checkingAuth = false
        state.joined = true
        state.token = action.payload.token || null
        if (action.payload.playerName) {
          state.playerName = action.payload.playerName
        }
      })
      .addCase(checkAuth.rejected, (state) => {
        state.checkingAuth = false
        state.joined = false
        state.token = null
      })
      .addCase(joinGame.pending, (state) => {
        state.error = ''
      })
      .addCase(joinGame.fulfilled, (state, action) => {
        state.joined = true
        state.playerName = action.payload.playerName
        state.token = action.payload.token
        state.error = ''
      })
      .addCase(joinGame.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(startGame.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(performAction.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(nextHand.fulfilled, (state) => {
        state.validActions = null
        state.error = ''
      })
      .addCase(nextHand.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(revealCard.fulfilled, (state) => {
        state.canRevealCard = false
        state.error = ''
      })
      .addCase(revealCard.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(advanceRound.fulfilled, (state) => {
        state.validActions = null
        state.error = ''
      })
      .addCase(advanceRound.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(toggleShowCards.rejected, (state, action) => {
        state.error = action.payload as string
      })
      .addCase(fetchValidActions.fulfilled, (state, action) => {
        state.validActions = action.payload
        if (action.payload.canBet && action.payload.minBet !== undefined) {
          state.betAmount = action.payload.minBet
        }
        if (action.payload.canRaise && action.payload.minRaise !== undefined) {
          state.raiseAmount = action.payload.minRaise
        }
        if (action.payload.canReveal !== undefined) {
          state.canRevealCard = action.payload.canReveal
        }
      })
      .addCase(fetchValidActions.rejected, () => {})
  },
})

export const {
  setPlayerName,
  setBetAmount,
  setRaiseAmount,
  setError,
  setWsConnected,
  setCanRevealCard,
  clearValidActions,
  initializeBettingAmounts,
} = playerSlice.actions

export default playerSlice.reducer

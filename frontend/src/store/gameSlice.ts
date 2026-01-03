import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import axios from 'axios'
import type { GameState } from '../components/table/types'

type GameStateWithNull = GameState | null

interface GameStatus {
  game: GameStateWithNull
  loading: boolean
  error: string
  wsConnected: boolean
}

const initialState: GameStatus = {
  game: null,
  loading: true,
  error: '',
  wsConnected: false,
}

export const fetchGameByRoom = createAsyncThunk(
  'game/fetchByRoom',
  async (roomCode: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/api/games/room/${roomCode}/state`)
      return response.data as GameState
    } catch (err: unknown) {
      if (!axios.isAxiosError(err)) {
        return rejectWithValue('Failed to fetch game')
      }
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch game')
    }
  },
)

export const resetGame = createAsyncThunk(
  'game/reset',
  async (roomCode: string, { rejectWithValue }) => {
    try {
      await axios.post(`/api/games/room/${roomCode}/reset`)
      return true
    } catch (err: unknown) {
      if (!axios.isAxiosError(err)) {
        return rejectWithValue('Failed to reset game')
      }
      return rejectWithValue(err.response?.data?.error || 'Failed to reset game')
    }
  },
)

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGame: (state, action: PayloadAction<GameState>) => {
      state.game = action.payload
      state.error = ''
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
    },
    setWsConnected: (state, action: PayloadAction<boolean>) => {
      state.wsConnected = action.payload
    },
    clearGame: (state) => {
      state.game = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGameByRoom.pending, (state) => {
        state.loading = true
        state.error = ''
      })
      .addCase(fetchGameByRoom.fulfilled, (state, action) => {
        state.loading = false
        state.game = action.payload
      })
      .addCase(fetchGameByRoom.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(resetGame.fulfilled, (state) => {
        state.error = ''
      })
      .addCase(resetGame.rejected, (state, action) => {
        state.error = action.payload as string
      })
  },
})

export const { setGame, setLoading, setError, setWsConnected, clearGame } = gameSlice.actions
export default gameSlice.reducer

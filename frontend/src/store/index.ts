import { configureStore } from '@reduxjs/toolkit'
import gameReducer from './gameSlice'
import playerReducer from './playerSlice'
import soundReducer from './soundSlice'

export const store = configureStore({
  reducer: {
    game: gameReducer,
    player: playerReducer,
    sound: soundReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

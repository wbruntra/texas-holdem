import { configureStore } from '@reduxjs/toolkit'
import gameReducer from './gameSlice'
import soundReducer from './soundSlice'

export const store = configureStore({
  reducer: {
    game: gameReducer,
    sound: soundReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

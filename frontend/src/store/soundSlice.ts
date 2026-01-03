import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface SoundState {
  previousPlayerActions: Record<string, string | null>
  previousCommunityCardsCount: number
}

const initialState: SoundState = {
  previousPlayerActions: {},
  previousCommunityCardsCount: 0,
}

const soundSlice = createSlice({
  name: 'sound',
  initialState,
  reducers: {
    setPreviousPlayerActions: (state, action: PayloadAction<Record<string, string | null>>) => {
      state.previousPlayerActions = action.payload
    },
    setPreviousCommunityCardsCount: (state, action: PayloadAction<number>) => {
      state.previousCommunityCardsCount = action.payload
    },
  },
})

export const { setPreviousPlayerActions, setPreviousCommunityCardsCount } = soundSlice.actions
export default soundSlice.reducer

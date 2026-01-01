import { useEffect, useRef } from 'react'
import checkSound from '../assets/check.mp3'
import betSound from '../assets/bet.wav'
import cardFlipSound from '../assets/card_flip.mp3'

export function useSoundEffects() {
  const checkAudioRef = useRef<HTMLAudioElement | null>(null)
  const betAudioRef = useRef<HTMLAudioElement | null>(null)
  const cardFlipAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Initialize audio elements
    checkAudioRef.current = new Audio(checkSound)
    betAudioRef.current = new Audio(betSound)
    cardFlipAudioRef.current = new Audio(cardFlipSound)

    // Preload the sounds
    checkAudioRef.current.load()
    betAudioRef.current.load()
    cardFlipAudioRef.current.load()

    return () => {
      // Cleanup
      if (checkAudioRef.current) {
        checkAudioRef.current.pause()
        checkAudioRef.current = null
      }
      if (betAudioRef.current) {
        betAudioRef.current.pause()
        betAudioRef.current = null
      }
      if (cardFlipAudioRef.current) {
        cardFlipAudioRef.current.pause()
        cardFlipAudioRef.current = null
      }
    }
  }, [])

  const playCheckSound = () => {
    if (checkAudioRef.current) {
      // Reset to start if already playing
      checkAudioRef.current.currentTime = 0
      checkAudioRef.current.play().catch((err) => {
        console.warn('Failed to play check sound:', err)
      })
    }
  }

  const playBetSound = () => {
    if (betAudioRef.current) {
      // Reset to start if already playing
      betAudioRef.current.currentTime = 0
      betAudioRef.current.play().catch((err) => {
        console.warn('Failed to play bet sound:', err)
      })
    }
  }

  const playCardFlipSound = () => {
    if (cardFlipAudioRef.current) {
      // Reset to start if already playing
      cardFlipAudioRef.current.currentTime = 0
      cardFlipAudioRef.current.play().catch((err) => {
        console.warn('Failed to play card flip sound:', err)
      })
    }
  }

  return { playCheckSound, playBetSound, playCardFlipSound }
}

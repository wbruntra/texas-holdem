import { useEffect, useRef, useState } from 'react'

type Direction = 'up' | 'down' | null

export function useAnimatedNumber(
  target: number,
  delay = 400,
  duration = 800,
  initialValue?: number,
) {
  const [display, setDisplay] = useState(initialValue ?? target)
  const [isAnimating, setIsAnimating] = useState(false)
  const [direction, setDirection] = useState<Direction>(null)
  const displayRef = useRef(initialValue ?? target)
  const frameRef = useRef<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (target === displayRef.current) return

    timeoutRef.current = setTimeout(() => {
      const start = displayRef.current
      const diff = target - start
      const startTime = performance.now()
      setIsAnimating(true)
      setDirection(diff > 0 ? 'up' : diff < 0 ? 'down' : null)

      const step = (now: number) => {
        const elapsed = now - startTime
        const t = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        const next = Math.round(start + diff * eased)
        displayRef.current = next
        setDisplay(next)

        if (t < 1) {
          frameRef.current = requestAnimationFrame(step)
        } else {
          displayRef.current = target
          setDisplay(target)
          setIsAnimating(false)
        }
      }
      frameRef.current = requestAnimationFrame(step)
    }, delay)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, delay, duration])

  return { value: display, isAnimating, direction }
}

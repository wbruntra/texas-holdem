import { useState, useEffect, useRef } from 'react'

type Props = {
  end: number
  duration?: number
  prefix?: string
  suffix?: string
}

export default function CountUp({ end, duration = 500, prefix = '', suffix = '' }: Props) {
  const [count, setCount] = useState(0)
  const previousEnd = useRef(end)
  const animationFrameId = useRef<number>()
  const hasAnimated = useRef(false)

  useEffect(() => {
    previousEnd.current = end
    hasAnimated.current = false
  }, [end])

  useEffect(() => {
    if (hasAnimated.current) return

    const startValue = 0
    const endValue = previousEnd.current
    const startTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      const easeOut = 1 - Math.pow(1 - progress, 4)
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOut)

      setCount(currentValue)

      if (progress < 1) {
        animationFrameId.current = requestAnimationFrame(animate)
      } else {
        hasAnimated.current = true
      }
    }

    animationFrameId.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [duration])

  return (
    <span>
      {prefix}
      {count}
      {suffix}
    </span>
  )
}

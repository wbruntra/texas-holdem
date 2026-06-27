import { verticalSliderStyles } from '../styles/verticalSliderStyles'

interface VerticalSliderProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  thumbColor?: string
  trackColor?: string
  height?: number
  showFill?: boolean
}

export default function VerticalSlider({
  value,
  min,
  max,
  step,
  onChange,
  thumbColor = '#0a0',
  trackColor = 'rgba(255,255,255,0.1)',
  height = 160,
  showFill = true,
}: VerticalSliderProps) {
  const percentage = showFill ? ((value - min) / (max - min)) * 100 : 0

  const dynamicStyles = `
    .vertical-slider::-webkit-slider-runnable-track {
      background: linear-gradient(
        to top,
        ${thumbColor} 0%,
        ${thumbColor} ${percentage}%,
        ${trackColor} ${percentage}%,
        ${trackColor} 100%
      );
    }
    .vertical-slider::-webkit-slider-thumb {
      background: ${thumbColor};
    }
    .vertical-slider::-moz-range-track {
      background: linear-gradient(
        to top,
        ${thumbColor} 0%,
        ${thumbColor} ${percentage}%,
        ${trackColor} ${percentage}%,
        ${trackColor} 100%
      );
    }
    .vertical-slider::-moz-range-thumb {
      background: ${thumbColor};
    }
  `

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: `${height}px`,
        justifyContent: 'center',
      }}
    >
      <style>{verticalSliderStyles}</style>
      <style>{dynamicStyles}</style>

      <input
        type="range"
        className="vertical-slider"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseInt(e.target.value))}
      />
    </div>
  )
}

import { sliderStyles } from '../styles/sliderStyles'

interface HorizontalSliderProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  thumbColor?: string
  trackColor?: string
}

export default function HorizontalSlider({
  value,
  min,
  max,
  step,
  onChange,
  thumbColor = '#0a0',
  trackColor = '#456',
}: HorizontalSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100

  // Generate dynamic styles for the slider track with gradient
  const dynamicSliderStyles = `
    .horizontal-slider::-webkit-slider-runnable-track {
      background: linear-gradient(
        to right,
        ${thumbColor} 0%,
        ${thumbColor} ${percentage}%,
        ${trackColor} ${percentage}%,
        ${trackColor} 100%
      );
    }
    
    .horizontal-slider::-webkit-slider-thumb {
      background: ${thumbColor};
      box-shadow: 0 2px 6px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.2);
    }
    
    .horizontal-slider::-webkit-slider-thumb:hover {
      box-shadow: 0 3px 10px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.3);
    }
    
    .horizontal-slider::-webkit-slider-thumb:active {
      box-shadow: 0 1px 4px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.4);
    }
    
    /* Firefox */
    .horizontal-slider::-moz-range-track {
      background: linear-gradient(
        to right,
        ${thumbColor} 0%,
        ${thumbColor} ${percentage}%,
        ${trackColor} ${percentage}%,
        ${trackColor} 100%
      );
    }
    
    .horizontal-slider::-moz-range-thumb {
      background: ${thumbColor};
      box-shadow: 0 2px 6px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.2);
    }
    
    .horizontal-slider::-moz-range-thumb:hover {
      box-shadow: 0 3px 10px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.3);
    }
    
    .horizontal-slider::-moz-range-thumb:active {
      box-shadow: 0 1px 4px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.4);
    }
  `

  return (
    <div style={{ width: '100%', position: 'relative', padding: '8px 0' }}>
      <style>{sliderStyles}</style>
      <style>{dynamicSliderStyles}</style>

      <input
        type="range"
        className="horizontal-slider"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseInt(e.target.value))}
      />
    </div>
  )
}

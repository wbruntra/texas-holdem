interface VerticalSliderProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  thumbColor?: string
  trackColor?: string
}

export default function VerticalSlider({
  value,
  min,
  max,
  step,
  onChange,
  thumbColor = '#0a0',
  trackColor = '#456',
}: VerticalSliderProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '200px',
        justifyContent: 'center',
      }}
    >
      <style>{`
        .vertical-slider {
          width: 200px;
          height: 6px;
          cursor: pointer;
          writing-mode: vertical-lr;
          direction: rtl;
        }
        
        /* Webkit browsers (Chrome, Safari, Edge) */
        .vertical-slider::-webkit-slider-runnable-track {
          background: ${trackColor};
          border-radius: 3px;
          width: 200px;
          height: 6px;
        }
        
        .vertical-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${thumbColor};
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          border: none;
          margin-top: -6px;
        }
        
        /* Firefox */
        .vertical-slider::-moz-range-track {
          background: ${trackColor};
          border-radius: 3px;
          width: 200px;
          height: 6px;
          border: none;
        }
        
        .vertical-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${thumbColor};
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          border: none;
          margin-top: -6px;
        }
      `}</style>

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

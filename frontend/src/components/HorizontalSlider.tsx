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

  return (
    <div style={{ width: '100%', position: 'relative', padding: '8px 0' }}>
      <style>{`
        .horizontal-slider {
          width: 100%;
          height: 8px;
          cursor: pointer;
          background: transparent;
          -webkit-appearance: none;
          appearance: none;
          position: relative;
          z-index: 2;
        }
        
        /* Webkit browsers (Chrome, Safari, Edge) */
        .horizontal-slider::-webkit-slider-runnable-track {
          background: linear-gradient(
            to right,
            ${thumbColor} 0%,
            ${thumbColor} ${percentage}%,
            ${trackColor} ${percentage}%,
            ${trackColor} 100%
          );
          border-radius: 4px;
          height: 8px;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
          transition: background 0.15s ease;
        }
        
        .horizontal-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${thumbColor};
          cursor: grab;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.2);
          border: 2px solid rgba(255,255,255,0.9);
          margin-top: -10px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        
        .horizontal-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 3px 10px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.3);
        }
        
        .horizontal-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.05);
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
          border-radius: 4px;
          height: 8px;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
          border: none;
          transition: background 0.15s ease;
        }
        
        .horizontal-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${thumbColor};
          cursor: grab;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.2);
          border: 2px solid rgba(255,255,255,0.9);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        
        .horizontal-slider::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 3px 10px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.3);
        }
        
        .horizontal-slider::-moz-range-thumb:active {
          cursor: grabbing;
          transform: scale(1.05);
          box-shadow: 0 1px 4px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.4);
        }
      `}</style>

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

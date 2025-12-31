import React from 'react';

interface HorizontalSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  thumbColor?: string;
  trackColor?: string;
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
  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .horizontal-slider {
          width: 100%;
          height: 6px;
          cursor: pointer;
          background: transparent;
          -webkit-appearance: none;
          appearance: none;
        }
        
        /* Webkit browsers (Chrome, Safari, Edge) */
        .horizontal-slider::-webkit-slider-runnable-track {
          background: ${trackColor};
          border-radius: 3px;
          height: 6px;
        }
        
        .horizontal-slider::-webkit-slider-thumb {
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
        .horizontal-slider::-moz-range-track {
          background: ${trackColor};
          border-radius: 3px;
          height: 6px;
          border: none;
        }
        
        .horizontal-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${thumbColor};
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          border: none;
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
  );
}

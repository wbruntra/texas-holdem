/* Horizontal Slider Styles Module */

export const sliderStyles = `
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
    cursor: grab;
    border: 2px solid rgba(255,255,255,0.9);
    margin-top: -10px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  
  .horizontal-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }
  
  .horizontal-slider::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.05);
  }
  
  /* Firefox */
  .horizontal-slider::-moz-range-track {
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
    cursor: grab;
    border: 2px solid rgba(255,255,255,0.9);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  
  .horizontal-slider::-moz-range-thumb:hover {
    transform: scale(1.15);
  }
  
  .horizontal-slider::-moz-range-thumb:active {
    cursor: grabbing;
    transform: scale(1.05);
  }
`

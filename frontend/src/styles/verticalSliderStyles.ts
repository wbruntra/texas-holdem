/* Vertical Slider Styles Module */

export const verticalSliderStyles = `
  .vertical-slider {
    width: 8px;
    height: 100%;
    cursor: pointer;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
    position: relative;
    z-index: 2;
    writing-mode: vertical-lr;
    direction: rtl;
  }

  /* Webkit browsers (Chrome, Safari, Edge) */
  .vertical-slider::-webkit-slider-runnable-track {
    border-radius: 4px;
    width: 10px;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
    transition: background 0.15s ease;
  }

  .vertical-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: grab;
    border: 2px solid rgba(255,255,255,0.9);
    margin-left: -11px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.15);
  }

  .vertical-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    box-shadow: 0 3px 10px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.25);
  }

  .vertical-slider::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.05);
    box-shadow: 0 1px 4px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.35);
  }

  /* Firefox */
  .vertical-slider::-moz-range-track {
    border-radius: 4px;
    width: 10px;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
    border: none;
    transition: background 0.15s ease;
  }

  .vertical-slider::-moz-range-thumb {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: grab;
    border: 2px solid rgba(255,255,255,0.9);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.15);
  }

  .vertical-slider::-moz-range-thumb:hover {
    transform: scale(1.15);
    box-shadow: 0 3px 10px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.25);
  }

  .vertical-slider::-moz-range-thumb:active {
    cursor: grabbing;
    transform: scale(1.05);
    box-shadow: 0 1px 4px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.35);
  }
`

/* Global button styles with hover and active states */
export const buttonBaseStyle = {
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 'bold' as const,
  transition: 'all 0.2s ease',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
}

export const buttonHoverStyle = `
  button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }
  button:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

/* Color gradients for different action types */
export const buttonStyles = {
  primary: {
    background: 'linear-gradient(135deg, #43a047 0%, #2e7d32 100%)',
    color: '#fff',
  },
  secondary: {
    background: 'linear-gradient(135deg, #43a047 0%, #388e3c 100%)',
    color: '#fff',
  },
  danger: {
    background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
    color: '#fff',
  },
  bet: {
    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
    color: '#fff',
  },
  raise: {
    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
    color: '#fff',
  },
  special: {
    background: 'linear-gradient(135deg, #00acc1 0%, #0097a7 100%)',
    color: '#fff',
  },
  advance: {
    background: 'linear-gradient(135deg, #5e35b1 0%, #512da8 100%)',
    color: '#fff',
  },
}

/* Container styles */
export const containerStyles = {
  main: {
    padding: '12px',
    minHeight: '100vh',
    backgroundColor: '#1a472a',
    color: '#fff',
    maxWidth: '600px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '12px',
    backgroundColor: '#234a34',
    padding: '12px',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  gameInfo: {
    textAlign: 'center' as const,
    padding: '10px',
    backgroundColor: '#234a34',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  sliderContainer: {
    marginBottom: '12px',
    padding: '16px',
    borderRadius: '12px',
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)',
  },
  betSlider: {
    background: 'linear-gradient(135deg, #2a5a3a 0%, #1f4a2f 100%)',
  },
  raiseSlider: {
    background: 'linear-gradient(135deg, #5a3a2a 0%, #4a2f1f 100%)',
  },
}

/* Card styles */
export const cardStyles = {
  holeCard: {
    backgroundColor: '#fff',
    padding: '12px 8px',
    borderRadius: '8px',
    fontSize: '32px',
    fontWeight: 'bold' as const,
    width: '60px',
    height: '88px',
    textAlign: 'center' as const,
    boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  showdownCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    fontSize: '20px',
    fontWeight: 'bold' as const,
    width: '44px',
    height: '64px',
    textAlign: 'center' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  faceDownCard: {
    backgroundColor: '#0066cc',
    background: 'linear-gradient(135deg, #0066cc 0%, #004499 100%)',
    borderRadius: '8px',
    fontSize: '20px',
    fontWeight: 'bold' as const,
    width: '44px',
    height: '64px',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    border: '1px solid rgba(255,255,255,0.85)',
    opacity: 0.85,
  },
}

/* Input styles */
export const inputStyles = {
  text: {
    width: '100%',
    maxWidth: '200px',
    padding: '15px',
    fontSize: '18px',
    marginBottom: '15px',
    boxSizing: 'border-box' as const,
  },
  password: {
    width: '100%',
    maxWidth: '200px',
    padding: '15px',
    fontSize: '18px',
    marginBottom: '15px',
    boxSizing: 'border-box' as const,
  },
}

/* Spinner/Loader styles */
export const loaderStyles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
    textAlign: 'center' as const,
    minHeight: '100vh',
    backgroundColor: '#1a472a',
    color: '#fff',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    justifyContent: 'center' as const,
  },
}

/* Error message styles */
export const errorStyles = {
  marginTop: '20px',
  padding: '15px',
  backgroundColor: '#fee',
  color: '#c00',
  borderRadius: '5px',
  textAlign: 'center' as const,
}

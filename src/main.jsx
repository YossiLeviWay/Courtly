import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { GameProvider } from './context/GameContext.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: '2rem',
          fontFamily: 'sans-serif', background: '#1a1a1a', color: '#fff',
        }}>
          <h2 style={{ color: '#E8621A', marginBottom: '1rem' }}>Something went wrong</h2>
          <pre style={{
            background: '#2a2a2a', padding: '1rem', borderRadius: '8px',
            maxWidth: '90vw', overflow: 'auto', fontSize: '12px',
            color: '#ff8080', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem', padding: '0.75rem 2rem',
              background: '#E8621A', color: '#fff', border: 'none',
              borderRadius: '8px', cursor: 'pointer', fontSize: '1rem',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)

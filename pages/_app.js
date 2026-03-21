import '../src/index.css';
import '../src/App.css';
import { ThemeProvider } from '../src/context/ThemeContext';
import { GameProvider } from '../src/context/GameContext';

export default function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <GameProvider>
        <Component {...pageProps} />
      </GameProvider>
    </ThemeProvider>
  );
}

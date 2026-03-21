import dynamic from 'next/dynamic';

// Render the full React SPA client-side only (uses BrowserRouter + React Router)
const App = dynamic(() => import('../src/App'), { ssr: false });

export default function Page() {
  return <App />;
}

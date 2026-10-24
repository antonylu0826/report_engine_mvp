import { Buffer } from 'buffer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './DemoApp.tsx';

// Polyfill Buffer for browser environment (eliminates react-pdf buffer warnings)
if (typeof window !== 'undefined') {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

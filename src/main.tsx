import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { PwaPrompt } from '@/components/pwa-prompt';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PwaPrompt />
  </StrictMode>,
);

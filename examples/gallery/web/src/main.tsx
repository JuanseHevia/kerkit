import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './index.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

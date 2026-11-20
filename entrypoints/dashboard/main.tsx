import React from 'react';
import ReactDOM from 'react-dom/client';
import { setLanguage } from '@/lib/i18n';
import { getSettings } from '@/lib/store';
import App from './App.tsx';
import './style.css';

// The language is needed before anything is drawn.
void getSettings().then((settings) => {
  setLanguage(settings.language);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});

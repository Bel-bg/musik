import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import { MiniPlayerWindow } from '@/components/player/MiniPlayerWindow';
import '@/styles/globals.css';

// La fenêtre miniature charge la même page avec ?mini=1 : pas d'AudioEngine ni de chargement de bibliothèque.
const isMini = new URLSearchParams(window.location.search).get('mini') === '1';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isMini ? <MiniPlayerWindow /> : <App />}
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { setupPwa } from './pwa';
import './styles/index.css';

setupPwa();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

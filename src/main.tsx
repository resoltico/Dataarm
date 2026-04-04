import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

/** The single React mount point for the desktop frontend. */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element "#root" was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

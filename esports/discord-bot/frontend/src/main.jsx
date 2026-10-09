import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';

const bootstrap = window.__GG_BOOTSTRAP__ || {};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App initialData={bootstrap} />
  </React.StrictMode>
);

// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';

/* ➡️  1. import the provider  */
import { SignalLightsProvider } from './SignalLightsContext';
import { LabelProvider } from './LabelContext.jsx';
import { GrassLabelProvider } from './GrassLabelContext.jsx';
import { GrassTypesProvider } from './GrassTypesContext.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SignalLightsProvider>
      <LabelProvider>
        <GrassLabelProvider>
          <GrassTypesProvider>
            <BrowserRouter basename="/farmt">
              <App />
            </BrowserRouter>
          </GrassTypesProvider>
        </GrassLabelProvider>
      </LabelProvider>
    </SignalLightsProvider>
  </React.StrictMode>
);

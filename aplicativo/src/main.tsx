import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './bc-layout.css';
import { Capacitor } from '@capacitor/core';

// Platform is a presentation choice only; it never enters the private vault.
const platform = Capacitor.getPlatform() === 'android' ? 'android' : location.protocol === 'app:' ? 'desktop' : 'web';
const compactViewport = matchMedia('(max-width: 900px)');
const applyLayout = () => {
  document.documentElement.dataset.platform = platform;
  document.documentElement.dataset.layout = platform === 'android' || platform === 'web' && compactViewport.matches ? 'android' : 'desktop';
};
applyLayout();
compactViewport.addEventListener('change', applyLayout);
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
if(import.meta.env.PROD&&'serviceWorker' in navigator&&location.protocol!=='app:')navigator.serviceWorker.register('/sw.js').catch(()=>{/* A base local continua disponível; o estado da instalação aparece em Atualizações. */});

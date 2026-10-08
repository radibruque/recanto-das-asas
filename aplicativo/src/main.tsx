import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
if(import.meta.env.PROD&&'serviceWorker' in navigator&&location.protocol!=='app:')navigator.serviceWorker.register('/sw.js').catch(()=>{/* A base local continua disponível; o estado da instalação aparece em Atualizações. */});

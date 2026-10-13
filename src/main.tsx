import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

// Platform cache adapter for the compiled interface; media storage stays in Rust.
if(import.meta.env.PROD && !window.desktop && "serviceWorker" in navigator){
  window.addEventListener("load",()=>{void navigator.serviceWorker.register(new URL(`${import.meta.env.BASE_URL}sw.js`,location.href)).catch(()=>{});});
}

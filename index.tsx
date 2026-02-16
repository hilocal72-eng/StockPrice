import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Register Service Worker for Push Notifications
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    // Simple relative registration is often the most compatible for framed environments.
    // The browser handles resolving this against the frame's origin.
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('SW registered successfully with scope:', registration.scope);
        
        // Check for updates
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('New content available; please refresh.');
                } else {
                  console.log('Content cached for offline use.');
                }
              }
            };
          }
        };
      })
      .catch(error => {
        // Logging as warning instead of error to avoid cluttering in dev environments 
        // where SW might be restricted or blocked by sandboxing.
        console.warn('SW registration skipped or failed:', error.message);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
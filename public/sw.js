self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

// A fetch event handler is required by Chrome to trigger the 'beforeinstallprompt' event
self.addEventListener('fetch', (e) => {
  // We don't need to actually cache anything for the prompt to work,
  // just having the listener satisfies the PWA installability criteria.
});

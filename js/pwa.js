if ('serviceWorker' in navigator) {
  const serviceWorkerUrl = new URL('../sw.js', document.currentScript.src);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.error('Offline-Modus konnte nicht eingerichtet werden.', error);
    });
  });
}

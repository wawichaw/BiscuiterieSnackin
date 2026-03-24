/**
 * Charge Google Identity Services (gsi/client) une seule fois, à la demande.
 * Évite ~90 Kio sur les pages qui n’utilisent pas la connexion Google.
 */
const GSI_SRC = 'https://accounts.google.com/gsi/client';

let inflight = null;

export function loadGoogleGsi() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();

  if (!inflight) {
    inflight = (async () => {
      let script = document.querySelector(`script[src="${GSI_SRC}"]`);

      if (!script) {
        script = document.createElement('script');
        script.src = GSI_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('Échec chargement Google Sign-In'));
        });
      } else {
        await new Promise((resolve, reject) => {
          if (window.google?.accounts?.id) {
            resolve();
            return;
          }
          script.addEventListener('load', resolve, { once: true });
          script.addEventListener(
            'error',
            () => reject(new Error('Échec chargement Google Sign-In')),
            { once: true }
          );
        });
      }

      if (!window.google?.accounts?.id) {
        throw new Error('Google Identity Services indisponible');
      }
    })().finally(() => {
      inflight = null;
    });
  }

  return inflight;
}

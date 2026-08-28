// reCAPTCHA v3 — carga perezosa y ejecución bajo demanda.
//
// La clave de sitio llega por variable de entorno. Si no está configurada, las
// funciones devuelven null y el formulario sigue funcionando: el backend es
// quien decide si un envío sin token se acepta o se rechaza.

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

let loader: Promise<boolean> | null = null;

function loadScript(): Promise<boolean> {
  if (!RECAPTCHA_SITE_KEY) return Promise.resolve(false);
  if (loader) return loader;

  loader = new Promise<boolean>((resolve) => {
    if (window.grecaptcha) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return loader;
}

/** Precalienta el script para que el primer envío no espere la descarga. */
export function preloadRecaptcha(): void {
  void loadScript();
}

/** Token para una acción concreta, o null si reCAPTCHA no está disponible. */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  const ready = await loadScript();
  if (!ready || !window.grecaptcha) return null;

  return new Promise<string | null>((resolve) => {
    window.grecaptcha!.ready(() => {
      window
        .grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action })
        .then(resolve)
        .catch(() => resolve(null));
    });
  });
}

// Contador de visitas de las páginas públicas (ver supabase/metricas.sql).
// Sin cookies: manda solo la página, el dominio de donde llegó y el tipo de dispositivo.
import { supabase as config } from '../data/site';

/** Marca que se guarda en el navegador del administrador para que sus visitas no cuenten. */
export const NO_CONTAR = 'jp-no-contar';

function dispositivo() {
  const ua = navigator.userAgent;
  // Los iPad nuevos se presentan como Mac, pero tienen pantalla táctil.
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ipad || /Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'celular';
  return 'compu';
}

export function registrarVisita() {
  // Solo en la web publicada: lo que se mira en la compu mientras se trabaja no cuenta.
  if (!import.meta.env.PROD || !config.clave || navigator.webdriver) return;
  try {
    if (localStorage.getItem(NO_CONTAR)) return;
  } catch {
    // Sin almacenamiento disponible: se cuenta igual.
  }
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let ruta = location.pathname;
  if (base && ruta.startsWith(base)) ruta = ruta.slice(base.length) || '/';
  if (ruta.startsWith('/clientes')) return;
  let referente = '';
  try {
    if (document.referrer && new URL(document.referrer).host !== location.host) referente = document.referrer;
  } catch {
    // Referente ilegible: se toma como entrada directa.
  }
  fetch(`${config.url}/rest/v1/rpc/registrar_visita`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: config.clave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ruta, referente, dispositivo: dispositivo() }),
  }).catch(() => {});
}

// Contador de visitas y de clics de contacto de las páginas públicas (ver
// supabase/metricas.sql). Sin cookies: manda solo la página, el dominio de donde
// llegó, el tipo de dispositivo y, en los clics, a qué canal de contacto fue.
import { supabase as config } from '../data/site';

/** Marca que se guarda en el navegador del administrador para que sus visitas no cuenten. */
export const NO_CONTAR = 'jp-no-contar';

export type Destino = 'whatsapp' | 'formulario' | 'instagram' | 'youtube' | 'email' | 'contacto';

function dispositivo() {
  const ua = navigator.userAgent;
  // Los iPad nuevos se presentan como Mac, pero tienen pantalla táctil.
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ipad || /Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'celular';
  return 'compu';
}

/** Página actual sin el prefijo del sitio, o null si esta visita no se cuenta. */
function rutaQueCuenta() {
  // Solo en la web publicada: lo que se mira en la compu mientras se trabaja no cuenta.
  if (!import.meta.env.PROD || !config.clave || navigator.webdriver) return null;
  try {
    if (localStorage.getItem(NO_CONTAR)) return null;
  } catch {
    // Sin almacenamiento disponible: se cuenta igual.
  }
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let ruta = location.pathname;
  if (base && ruta.startsWith(base)) ruta = ruta.slice(base.length) || '/';
  return ruta.startsWith('/clientes') ? null : ruta;
}

function enviar(funcion: string, datos: Record<string, string>) {
  fetch(`${config.url}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    // Sigue aunque el clic lleve a otra página.
    keepalive: true,
    headers: { apikey: config.clave, 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  }).catch(() => {});
}

export function registrarVisita() {
  const ruta = rutaQueCuenta();
  if (!ruta) return;
  let referente = '';
  try {
    if (document.referrer && new URL(document.referrer).host !== location.host) referente = document.referrer;
  } catch {
    // Referente ilegible: se toma como entrada directa.
  }
  enviar('registrar_visita', { ruta, referente, dispositivo: dispositivo() });
}

export function registrarClic(destino: Destino) {
  const ruta = rutaQueCuenta();
  if (ruta) enviar('registrar_clic', { ruta, destino });
}

/** A qué canal de contacto lleva un enlace; null si no es de contacto. */
function destinoDe(enlace: HTMLAnchorElement): Destino | null {
  const href = enlace.href;
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com|(www\.)?whatsapp\.com)\//i.test(href)) return 'whatsapp';
  if (/^https:\/\/(www\.)?instagram\.com\//i.test(href)) return 'instagram';
  if (/^https:\/\/((www|m)\.)?(youtube\.com|youtu\.be)\//i.test(href)) return 'youtube';
  if (href.startsWith('mailto:')) return 'email';
  // Botones "Contactar" del contenido; el enlace del menú es navegación, no cuenta.
  if (enlace.host === location.host && /\/contacto\/?$/.test(enlace.pathname) && !enlace.closest('header, nav, footer')) {
    return 'contacto';
  }
  return null;
}

/** Anota los clics en enlaces de contacto de toda la página. */
export function seguirClics() {
  document.addEventListener(
    'click',
    (e) => {
      const enlace = (e.target as Element | null)?.closest?.('a[href]');
      if (!(enlace instanceof HTMLAnchorElement)) return;
      const destino = destinoDe(enlace);
      if (destino) registrarClic(destino);
    },
    { capture: true },
  );
}

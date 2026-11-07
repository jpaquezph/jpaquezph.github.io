import { sitio } from '../data/site';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Ruta interna respetando el `base` del sitio (GitHub Pages). */
export const url = (ruta = '') => `${base}/${ruta.replace(/^\//, '')}`;

export const urlWhatsapp = (mensaje = '') =>
  `https://wa.me/${sitio.whatsapp}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;

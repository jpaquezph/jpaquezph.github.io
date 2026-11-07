// Conexión del panel (pestañas "Fotos de la web" y "Álbumes") con la función
// admin-contenido de Supabase, que es la que guarda los cambios en GitHub.

import type { Estado, Foto, Resultado } from './contenido-edicion';
import { aBase64, type FotoLista } from './imagenes';
import { cliente } from './supabase';

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await cliente.functions.invoke('admin-contenido', { body: cuerpo });
  if (!error) return data as T;
  const respuesta = (error as { context?: Response }).context;
  const detalle = respuesta ? await respuesta.json().catch(() => null) : null;
  if (!detalle && /Failed to send|fetch/i.test(error.message)) {
    throw new Error('No se pudo conectar con Supabase. ¿Está cargada la función admin-contenido?');
  }
  throw new Error(detalle?.error ?? 'No se pudo completar la operación.');
}

/** Estado actual, leído del repositorio: lo último guardado, aunque todavía se esté publicando. */
export const leerEstado = () => llamar<Estado>({ accion: 'leer' });

export interface Subida {
  ruta: string;
  blob: Blob;
}

// Vista previa de las fotos recién subidas: hasta que la web se vuelve a publicar,
// esos archivos todavía no están en el sitio.
const previas = new Map<string, string>();
export const vistaPrevia = (ruta: string) => previas.get(ruta);

const sufijo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Le da nombre a una foto preparada dentro de `carpeta` (relativa a public/) y
 * devuelve cómo queda en los datos y qué archivos hay que subir.
 * Cada archivo tiene un nombre nuevo, así nadie ve una versión vieja guardada en caché.
 */
export function ubicar(lista: FotoLista, carpeta: string, prefijo: string): { foto: Foto; subidas: Subida[] } {
  const base = `${carpeta}/${prefijo}-${sufijo()}`;
  const src = `${base}.${lista.ext}`;
  const thumb = lista.chica ? `${base}-m.${lista.ext}` : src;
  const subidas = [{ ruta: `public/${src}`, blob: lista.grande }];
  if (lista.chica) subidas.push({ ruta: `public/${thumb}`, blob: lista.chica });
  previas.set(src, URL.createObjectURL(lista.grande));
  previas.set(thumb, URL.createObjectURL(lista.chica ?? lista.grande));
  return { foto: { src, thumb, w: lista.w, h: lista.h, color: lista.color }, subidas };
}

const TANDA = 4 * 1024 * 1024; // base64 por pedido

/**
 * Guarda el cambio en un solo commit: sube las fotos nuevas en tandas y después
 * manda los datos y la lista de archivos a borrar. La web se vuelve a publicar sola.
 */
export async function guardarCambio(
  resultado: Resultado,
  subidas: Subida[],
  mensaje: string,
  alAvanzar?: (texto: string) => void,
) {
  const agregar: { ruta: string; sha: string }[] = [];
  let tanda: { ruta: string; base64: string }[] = [];
  let peso = 0;
  const enviar = async () => {
    if (!tanda.length) return;
    const { subidos } = await llamar<{ subidos: { ruta: string; sha: string }[] }>({ accion: 'subir', archivos: tanda });
    agregar.push(...subidos);
    alAvanzar?.(`Subiendo fotos: ${agregar.length} de ${subidas.length} archivos…`);
    tanda = [];
    peso = 0;
  };
  for (const s of subidas) {
    const base64 = await aBase64(s.blob);
    if (peso + base64.length > TANDA) await enviar();
    tanda.push({ ruta: s.ruta, base64 });
    peso += base64.length;
  }
  await enviar();
  alAvanzar?.('Guardando el cambio…');
  return llamar<{ commit: string }>({
    accion: 'guardar',
    mensaje,
    agregar,
    borrar: resultado.borrar,
    datos: { 'src/data/contenido.json': resultado.contenido, 'src/data/galeria.json': resultado.galeria },
  });
}

export interface EstadoPublicacion {
  estado: 'queued' | 'in_progress' | 'completed' | 'sin-datos' | string;
  resultado?: 'success' | 'failure' | 'cancelled' | null;
  commit?: string;
  cuando?: string;
  enlace?: string;
}

export const estadoPublicacion = () => llamar<EstadoPublicacion>({ accion: 'estado' });

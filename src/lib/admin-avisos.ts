// Avisos del panel: cosas para resolver, ordenadas de más a menos urgentes.
// Se calculan en el navegador del administrador con datos que el panel ya tiene.

import type { Estado } from './contenido-edicion';

export type Nivel = 'urgente' | 'atencion' | 'info';

export interface Aviso {
  nivel: Nivel;
  texto: string;
  /** Enlace a la pestaña donde se resuelve. */
  enlace?: { texto: string; ruta: string };
}

/** Días para entregar las fotos, según las condiciones generales. */
const DIAS_ENTREGA = 20;
const DIA = 24 * 60 * 60 * 1000;

const hoy = () => {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};
/** "AAAA-MM-DD" a milisegundos (medianoche UTC), para contar días sin líos de horario. */
const diaDe = (fecha: string) => Date.parse(`${fecha.slice(0, 10)}T00:00:00Z`);
const fechaCorta = (fecha: string) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(diaDe(fecha));
const pesos = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const lista = (nombres: string[], max = 4) =>
  nombres.length <= max ? nombres.join(', ') : `${nombres.slice(0, max).join(', ')} y ${nombres.length - max} más`;

/** La llave de GitHub con la que el panel guarda los cambios. */
export function avisoDeLlave(vencimiento: string | null | undefined, error?: string): Aviso | null {
  const enlace = { texto: 'Cómo renovarla', ruta: 'https://github.com/settings/personal-access-tokens' };
  if (error) return { nivel: 'urgente', texto: `El panel no puede guardar fotos: ${error}`, enlace };
  if (!vencimiento) return null;
  const vence = Date.parse(vencimiento.replace(' UTC', 'Z').replace(' ', 'T'));
  if (Number.isNaN(vence)) return null;
  const dias = Math.ceil((vence - Date.now()) / DIA);
  if (dias < 0) return { nivel: 'urgente', texto: 'La llave de GitHub venció: el panel ya no puede guardar fotos ni álbumes.', enlace };
  if (dias <= 30) {
    return { nivel: dias <= 7 ? 'urgente' : 'atencion', texto: `La llave de GitHub vence en ${dias} día${dias === 1 ? '' : 's'}. Después el panel no va a poder guardar fotos.`, enlace };
  }
  return null;
}

/** Fotos y textos que le faltan a la web. */
export function avisosDeContenido(estado: Estado): Aviso[] {
  const avisos: Aviso[] = [];
  const fotos = { texto: 'Ir a Fotos de la web', ruta: 'clientes/fotos/' };
  const albumes = { texto: 'Ir a Álbumes', ruta: 'clientes/albumes/' };
  const sinLugar: string[] = [];
  const sinTitulo: string[] = [];
  const sinPase: string[] = [];

  for (const [slug, meta] of Object.entries(estado.contenido.categorias)) {
    const cat = estado.galeria.categorias.find((c) => c.slug === slug);
    const nombre = meta.nombre ?? cat?.nombre ?? slug;
    if (!cat?.albums.length) {
      avisos.push({ nivel: 'atencion', texto: `${nombre} no tiene álbumes: su página se ve vacía.`, enlace: albumes });
      continue;
    }
    const faltan = [
      !meta.tarjeta && 'la tarjeta de Portfolio',
      (meta.coverflow?.length ?? 0) < 2 && `${2 - (meta.coverflow?.length ?? 0)} foto(s) del carrusel de inicio`,
      !meta.pase && 'la primera foto del pase',
    ].filter((x): x is string => !!x);
    if (faltan.length) avisos.push({ nivel: 'atencion', texto: `A ${nombre} le falta ${lista(faltan, 3)}.`, enlace: fotos });

    for (const album of cat.albums) {
      const datos = estado.contenido.albumes[`${slug}/${album.slug}`];
      const titulo = datos?.titulo ?? album.nombre;
      if (!datos) sinTitulo.push(titulo);
      else if (!datos.descripcion) sinLugar.push(titulo);
      if (!meta.banners?.[album.slug]?.length && !album.banners.length) sinPase.push(titulo);
    }
  }

  if (sinTitulo.length) {
    avisos.push({ nivel: 'atencion', texto: `${sinTitulo.length} proyecto(s) se ven con el nombre de la carpeta, sin título ni lugar: ${lista(sinTitulo)}.`, enlace: albumes });
  }
  if (sinLugar.length) {
    avisos.push({ nivel: 'info', texto: `${sinLugar.length} proyecto(s) sin lugar debajo del título: ${lista(sinLugar)}.`, enlace: albumes });
  }
  if (sinPase.length) {
    avisos.push({ nivel: 'info', texto: `${sinPase.length} proyecto(s) sin fotos propias para el pase (la web usa fotos del álbum recortadas): ${lista(sinPase)}.`, enlace: albumes });
  }
  return avisos;
}

export interface EventoParaAvisos {
  usuario: string;
  cliente: string;
  titulo: string;
  fecha: string;
  precio_total: number;
  pagos: { monto: number }[] | null;
  vencimiento_saldo: string | null;
  drive_url: string | null;
}

/** Saldos, entregas y eventos que se vienen. */
export function avisosDeClientes(eventos: EventoParaAvisos[]): Aviso[] {
  const avisos: Aviso[] = [];
  const ahora = hoy();
  for (const e of eventos) {
    const quien = `${e.cliente || e.usuario} (${e.titulo})`;
    const pagado = (e.pagos ?? []).reduce((suma, p) => suma + (Number(p.monto) || 0), 0);
    const saldo = (Number(e.precio_total) || 0) - pagado;
    if (saldo > 0 && e.vencimiento_saldo) {
      const dias = Math.round((diaDe(e.vencimiento_saldo) - ahora) / DIA);
      if (dias < 0) avisos.push({ nivel: 'urgente', texto: `Saldo vencido de ${quien}: ${pesos(saldo)}. Vencía el ${fechaCorta(e.vencimiento_saldo)}.` });
      else if (dias <= 7) avisos.push({ nivel: 'atencion', texto: `El saldo de ${quien} (${pesos(saldo)}) vence ${dias === 0 ? 'hoy' : `en ${dias} día${dias === 1 ? '' : 's'}`}.` });
    }
    if (!e.fecha) continue;
    const desdeEvento = Math.round((ahora - diaDe(e.fecha)) / DIA);
    if (!e.drive_url && desdeEvento > DIAS_ENTREGA) {
      avisos.push({ nivel: 'urgente', texto: `Fotos sin entregar de ${quien}: el evento fue hace ${desdeEvento} días y no tiene la carpeta de Drive cargada.` });
    } else if (!e.drive_url && desdeEvento >= DIAS_ENTREGA - 5 && desdeEvento >= 0) {
      avisos.push({ nivel: 'atencion', texto: `Quedan ${DIAS_ENTREGA - desdeEvento} día(s) para entregar las fotos de ${quien}.` });
    } else if (desdeEvento < 0 && desdeEvento >= -7) {
      avisos.push({ nivel: 'info', texto: `El evento de ${quien} es ${desdeEvento === -1 ? 'mañana' : `en ${-desdeEvento} días`} (${fechaCorta(e.fecha)}).` });
    } else if (desdeEvento === 0) {
      avisos.push({ nivel: 'info', texto: `Hoy es el evento de ${quien}.` });
    }
  }
  return avisos;
}

const peso: Record<Nivel, number> = { urgente: 0, atencion: 1, info: 2 };
export const ordenar = (avisos: Aviso[]) => [...avisos].sort((a, b) => peso[a.nivel] - peso[b.nivel]);

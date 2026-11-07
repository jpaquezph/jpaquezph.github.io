// Cambios de contenido que hace el panel de administración (pestañas "Fotos de la
// web" y "Álbumes"). Cada función recibe el estado actual (contenido.json y
// galeria.json), devuelve el estado nuevo y la lista de archivos de public/ que hay
// que borrar del repositorio. No toca la red: el panel manda el resultado a la
// función admin-contenido de Supabase, que hace el commit en GitHub.
//
// Las referencias a fotos de un álbum son por número ("album:3", tapa: 3, las fotos
// del destacado). Al quitar fotos se renumeran, y las que apuntaban a una foto
// quitada desaparecen: así ninguna parte de la web queda mostrando una foto borrada.

import type { FotoPropia, MetaCategoria } from '../data/site';

export type Foto = FotoPropia;

export interface Contenido {
  portada: { hero: Foto; heroFocoCelular: string; sobreMi: Foto };
  destacado: { categoria: string; album: string; titulo: string; texto: string; fotos: number[] };
  categorias: Record<string, MetaCategoria>;
  albumes: Record<string, { titulo: string; descripcion: string; tapa?: number }>;
}

export interface AlbumDatos {
  slug: string;
  nombre: string;
  total: number;
  fotos: Foto[];
  banners: Foto[];
}

export interface Galeria {
  categorias: { slug: string; nombre: string; albums: AlbumDatos[] }[];
}

export interface Estado {
  contenido: Contenido;
  galeria: Galeria;
}

export interface Resultado extends Estado {
  /** Archivos a borrar del repositorio, con la ruta desde la raíz (public/...). */
  borrar: string[];
}

/** Lugares de la web con una foto propia. */
export type Lugar =
  | { tipo: 'hero' }
  | { tipo: 'sobreMi' }
  | { tipo: 'coverflow'; categoria: string; indice: number }
  | { tipo: 'tarjeta'; categoria: string }
  | { tipo: 'pase'; categoria: string };

/** Medidas de cada tipo de foto: el panel recorta a esta proporción. `chico` = ancho de la versión liviana (0 = no lleva). */
export const MEDIDAS = {
  hero: { ancho: 2400, alto: 1350, chico: 1000 },
  sobreMi: { ancho: 1200, alto: 1600, chico: 600 },
  coverflow: { ancho: 1500, alto: 1000, chico: 800 },
  tarjeta: { ancho: 1200, alto: 1600, chico: 600 },
  pase: { ancho: 1180, alto: 320, chico: 0 },
  album: { lado: 2000, chico: 800 },
} as const;

const copia = <T>(valor: T): T => structuredClone(valor);

export function slug(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/gi, 'n')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const esArchivo = (f: unknown): f is Foto => !!f && typeof f === 'object' && 'src' in f;

/** Archivos de public/ que ocupa una foto (la grande y la chica, si son distintas). */
export const archivosDe = (f: Foto) => [...new Set([f.src, f.thumb])].map((r) => `public/${r}`);

/** Todas las rutas de archivo que usa el estado, para no borrar uno que siga en uso en otro lugar. */
function rutasEnUso(e: Estado) {
  const usadas = new Set<string>();
  const sumar = (f: unknown) => esArchivo(f) && archivosDe(f).forEach((r) => usadas.add(r));
  const { portada, categorias } = e.contenido;
  sumar(portada.hero);
  sumar(portada.sobreMi);
  for (const meta of Object.values(categorias)) {
    meta.coverflow?.forEach(sumar);
    sumar(meta.tarjeta);
    sumar(meta.pase);
    meta.paseSueltas?.forEach(sumar);
    Object.values(meta.banners ?? {}).forEach((lista) => lista.forEach(sumar));
  }
  for (const c of e.galeria.categorias) for (const a of c.albums) [...a.fotos, ...a.banners].forEach(sumar);
  return usadas;
}

/** De las rutas candidatas, las que ya nadie usa en el estado nuevo. */
function sinUso(e: Estado, candidatas: string[]) {
  const usadas = rutasEnUso(e);
  return [...new Set(candidatas)].filter((r) => !usadas.has(r));
}

function meta(c: Contenido, categoria: string) {
  const m = c.categorias[categoria];
  if (!m) throw new Error(`No existe la categoría "${categoria}".`);
  return m;
}

function album(g: Galeria, categoria: string, slugAlbum: string) {
  const a = g.categorias.find((c) => c.slug === categoria)?.albums.find((x) => x.slug === slugAlbum);
  if (!a) throw new Error('No existe ese álbum.');
  return a;
}

// --- Fotos de la web ---

export function fotoDeLugar(c: Contenido, lugar: Lugar): Foto | undefined {
  switch (lugar.tipo) {
    case 'hero':
      return c.portada.hero;
    case 'sobreMi':
      return c.portada.sobreMi;
    case 'coverflow': {
      const f = meta(c, lugar.categoria).coverflow?.[lugar.indice];
      return esArchivo(f) ? f : undefined;
    }
    case 'tarjeta':
      return meta(c, lugar.categoria).tarjeta;
    case 'pase':
      return meta(c, lugar.categoria).pase;
  }
}

/** Pone `foto` en el lugar; la que estaba se borra del repositorio si no se usa en otro lado. */
export function reemplazarLugar(e: Estado, lugar: Lugar, foto: Foto): Resultado {
  const n = copia(e);
  const anterior = fotoDeLugar(n.contenido, lugar);
  const c = n.contenido;
  switch (lugar.tipo) {
    case 'hero':
      c.portada.hero = foto;
      break;
    case 'sobreMi':
      c.portada.sobreMi = foto;
      break;
    case 'coverflow': {
      const m = meta(c, lugar.categoria);
      const lista = (m.coverflow ??= []);
      if (lugar.indice > lista.length) throw new Error('Posición del carrusel inválida.');
      lista[lugar.indice] = foto;
      break;
    }
    case 'tarjeta':
      meta(c, lugar.categoria).tarjeta = foto;
      break;
    case 'pase':
      meta(c, lugar.categoria).pase = foto;
      break;
  }
  return { ...n, borrar: anterior ? sinUso(n, archivosDe(anterior)) : [] };
}

/** Quita la foto del lugar. El banner principal y la foto de Sobre mí no se pueden quitar, solo cambiar. */
export function quitarLugar(e: Estado, lugar: Lugar): Resultado {
  if (lugar.tipo === 'hero' || lugar.tipo === 'sobreMi') {
    throw new Error('Esa foto no se puede quitar, solo cambiar por otra.');
  }
  const n = copia(e);
  const anterior = fotoDeLugar(n.contenido, lugar);
  const m = meta(n.contenido, lugar.categoria);
  if (lugar.tipo === 'coverflow') m.coverflow?.splice(lugar.indice, 1);
  if (lugar.tipo === 'tarjeta') delete m.tarjeta;
  if (lugar.tipo === 'pase') delete m.pase;
  return { ...n, borrar: anterior ? sinUso(n, archivosDe(anterior)) : [] };
}

/** Suma una foto al pase de la categoría: de un álbum (banners) o suelta (`album` vacío). */
export function agregarPase(e: Estado, categoria: string, slugAlbum: string, foto: Foto): Resultado {
  const n = copia(e);
  const m = meta(n.contenido, categoria);
  if (slugAlbum) {
    album(n.galeria, categoria, slugAlbum);
    ((m.banners ??= {})[slugAlbum] ??= []).push(foto);
  } else {
    (m.paseSueltas ??= []).push(foto);
  }
  return { ...n, borrar: [] };
}

export function quitarPase(e: Estado, categoria: string, slugAlbum: string, indice: number): Resultado {
  const n = copia(e);
  const m = meta(n.contenido, categoria);
  const lista = slugAlbum ? m.banners?.[slugAlbum] : m.paseSueltas;
  const [quitada] = lista?.splice(indice, 1) ?? [];
  if (!quitada) throw new Error('Esa foto del pase ya no está.');
  if (slugAlbum && m.banners && !m.banners[slugAlbum].length) delete m.banners[slugAlbum];
  return { ...n, borrar: sinUso(n, archivosDe(quitada)) };
}

// --- Álbumes ---

export function nuevoAlbum(
  e: Estado,
  categoria: string,
  datos: { titulo: string; descripcion: string },
  fotos: Foto[],
): Resultado & { slug: string } {
  const n = copia(e);
  meta(n.contenido, categoria);
  const titulo = datos.titulo.trim();
  if (!titulo) throw new Error('El álbum necesita un título.');
  if (!fotos.length) throw new Error('Elegí al menos una foto.');
  let cat = n.galeria.categorias.find((c) => c.slug === categoria);
  if (!cat) {
    cat = { slug: categoria, nombre: n.contenido.categorias[categoria].nombre ?? categoria, albums: [] };
    n.galeria.categorias.push(cat);
  }
  const base = slug(titulo) || 'album';
  let nuevo = base;
  for (let i = 2; cat.albums.some((a) => a.slug === nuevo); i++) nuevo = `${base}-${i}`;
  cat.albums.push({ slug: nuevo, nombre: titulo, total: fotos.length, fotos, banners: [] });
  n.contenido.albumes[`${categoria}/${nuevo}`] = { titulo, descripcion: datos.descripcion.trim() };
  return { ...n, borrar: [], slug: nuevo };
}

export function agregarFotos(e: Estado, categoria: string, slugAlbum: string, fotos: Foto[]): Resultado {
  const n = copia(e);
  const a = album(n.galeria, categoria, slugAlbum);
  a.fotos.push(...fotos);
  a.total = a.fotos.length;
  return { ...n, borrar: [] };
}

export function editarAlbum(
  e: Estado,
  categoria: string,
  slugAlbum: string,
  datos: { titulo: string; descripcion: string; tapa?: number },
): Resultado {
  const n = copia(e);
  const a = album(n.galeria, categoria, slugAlbum);
  const titulo = datos.titulo.trim();
  if (!titulo) throw new Error('El álbum necesita un título.');
  const tapa = datos.tapa && datos.tapa >= 1 && datos.tapa <= a.fotos.length ? datos.tapa : undefined;
  n.contenido.albumes[`${categoria}/${slugAlbum}`] = {
    titulo,
    descripcion: datos.descripcion.trim(),
    ...(tapa && tapa > 1 ? { tapa } : {}),
  };
  if (n.contenido.destacado.categoria === categoria && n.contenido.destacado.album === slugAlbum) {
    n.contenido.destacado.titulo = titulo;
  }
  return { ...n, borrar: [] };
}

/** Número nuevo de la foto `numero` después de quitar `quitadas`; null si fue quitada. */
function renumerar(numero: number, quitadas: Set<number>) {
  if (quitadas.has(numero)) return null;
  let menos = 0;
  for (const q of quitadas) if (q < numero) menos++;
  return numero - menos;
}

/** Corrige las referencias "album:numero" de una lista; quita las que apuntaban a fotos quitadas. */
function corregirReferencias<T>(lista: T[] | undefined, slugAlbum: string, quitadas: Set<number> | 'todas') {
  if (!lista) return lista;
  return lista.flatMap((item) => {
    if (typeof item !== 'string') return [item];
    const [a, num] = item.split(':');
    if (a !== slugAlbum) return [item];
    if (quitadas === 'todas') return [];
    const nuevo = renumerar(Number(num), quitadas);
    return nuevo ? [`${a}:${nuevo}` as T] : [];
  });
}

/** Quita fotos de un álbum (números desde 1) en toda la web y borra sus archivos. */
export function quitarFotos(e: Estado, categoria: string, slugAlbum: string, numeros: number[]): Resultado {
  const n = copia(e);
  const a = album(n.galeria, categoria, slugAlbum);
  const quitadas = new Set(numeros.filter((x) => x >= 1 && x <= a.fotos.length));
  if (!quitadas.size) throw new Error('Elegí qué fotos quitar.');
  if (quitadas.size >= a.fotos.length) {
    throw new Error('No se pueden quitar todas las fotos: para eso borrá el álbum entero.');
  }
  const archivos = a.fotos.filter((_, i) => quitadas.has(i + 1)).flatMap(archivosDe);
  a.fotos = a.fotos.filter((_, i) => !quitadas.has(i + 1));
  a.total = a.fotos.length;

  const m = meta(n.contenido, categoria);
  m.portadas = corregirReferencias(m.portadas, slugAlbum, quitadas) ?? [];
  m.coverflow = corregirReferencias(m.coverflow, slugAlbum, quitadas);

  const clave = `${categoria}/${slugAlbum}`;
  const datos = n.contenido.albumes[clave];
  if (datos?.tapa) {
    const tapa = renumerar(datos.tapa, quitadas);
    if (tapa && tapa > 1) datos.tapa = tapa;
    else delete datos.tapa;
  }

  const d = n.contenido.destacado;
  if (d.categoria === categoria && d.album === slugAlbum) {
    d.fotos = d.fotos.map((f) => renumerar(f, quitadas)).filter((f): f is number => !!f);
    if (!d.fotos.length) d.fotos = a.fotos.slice(0, 6).map((_, i) => i + 1);
  }
  return { ...n, borrar: sinUso(n, archivos) };
}

/** Borra el álbum entero: sus fotos, sus fotos del pase y toda referencia a él. */
export function borrarAlbum(e: Estado, categoria: string, slugAlbum: string): Resultado {
  const n = copia(e);
  const d = n.contenido.destacado;
  if (d.categoria === categoria && d.album === slugAlbum) {
    throw new Error('Es el trabajo destacado de la página de inicio. Elegí otro destacado antes de borrarlo.');
  }
  const a = album(n.galeria, categoria, slugAlbum);
  const cat = n.galeria.categorias.find((c) => c.slug === categoria)!;
  cat.albums = cat.albums.filter((x) => x.slug !== slugAlbum);
  if (!cat.albums.length) n.galeria.categorias = n.galeria.categorias.filter((c) => c !== cat);

  const m = meta(n.contenido, categoria);
  const pase = m.banners?.[slugAlbum] ?? [];
  if (m.banners) delete m.banners[slugAlbum];
  m.portadas = corregirReferencias(m.portadas, slugAlbum, 'todas') ?? [];
  m.coverflow = corregirReferencias(m.coverflow, slugAlbum, 'todas');
  delete n.contenido.albumes[`${categoria}/${slugAlbum}`];

  const archivos = [...a.fotos, ...a.banners, ...pase].flatMap(archivosDe);
  return { ...n, borrar: sinUso(n, archivos) };
}

/** Elige el trabajo destacado de la página de inicio: un álbum y hasta 6 de sus fotos. */
export function elegirDestacado(
  e: Estado,
  categoria: string,
  slugAlbum: string,
  datos: { texto: string; fotos: number[] },
): Resultado {
  const n = copia(e);
  const a = album(n.galeria, categoria, slugAlbum);
  const fotos = [...new Set(datos.fotos)].filter((f) => f >= 1 && f <= a.fotos.length).slice(0, 6);
  if (!fotos.length) throw new Error('Elegí al menos una foto para el destacado.');
  n.contenido.destacado = {
    categoria,
    album: slugAlbum,
    titulo: n.contenido.albumes[`${categoria}/${slugAlbum}`]?.titulo ?? a.nombre,
    texto: datos.texto.trim(),
    fotos,
  };
  return { ...n, borrar: [] };
}

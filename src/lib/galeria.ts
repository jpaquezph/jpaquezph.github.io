import datos from '../data/galeria.json';
import { albumesMeta, categoriasMeta } from '../data/site';
import { url, urlWhatsapp } from './rutas';

export interface Foto {
  src: string;
  thumb: string;
  w: number;
  h: number;
  color: string;
}

export interface Album {
  slug: string;
  nombre: string;
  descripcion: string;
  total: number;
  fotos: Foto[];
  /** Fotos propias para el pase de la categoría (carpeta "Banner" del proyecto). */
  banners?: Foto[];
  /** Foto de la tarjeta del álbum. */
  tapa?: Foto;
}

export interface Categoria {
  slug: string;
  nombre: string;
  icono: string;
  texto: string;
  portadas: Foto[];
  coverflow: Foto[];
  tarjeta: Foto;
  pase?: Foto;
  paseSueltas: Foto[];
  albums: Album[];
}

export { url, urlWhatsapp };

function fotoDe(albums: Album[], ref: string): Foto | undefined {
  const [slugAlbum, numero] = ref.split(':');
  return albums.find((a) => a.slug === slugAlbum)?.fotos[Number(numero) - 1];
}

type CategoriaImportada = Omit<
  Categoria,
  'icono' | 'texto' | 'portadas' | 'coverflow' | 'tarjeta' | 'pase' | 'paseSueltas'
>;
const importadas = datos.categorias as unknown as CategoriaImportada[];
// Categorías cargadas en `categoriasMeta` que todavía no tienen carpeta de fotos.
const sinFotos: CategoriaImportada[] = Object.entries(categoriasMeta)
  .filter(([slug]) => !importadas.some((c) => c.slug === slug))
  .map(([slug, meta]) => ({ slug, nombre: meta.nombre ?? slug, albums: [] }));

export const categorias: Categoria[] = [...importadas, ...sinFotos].map(
  (categoria) => {
    const meta = categoriasMeta[categoria.slug];
    const elegidas = (meta?.portadas ?? []).map((ref) => fotoDe(categoria.albums, ref)).filter((f) => !!f);
    const todas = categoria.albums.flatMap((a) => a.fotos);
    const albums = categoria.albums.map((album) => {
      const propio = albumesMeta[`${categoria.slug}/${album.slug}`];
      return {
        ...album,
        nombre: propio?.titulo ?? album.nombre,
        descripcion: propio?.descripcion ?? '',
        banners: meta?.banners?.[album.slug] ?? album.banners,
        tapa: album.fotos[(propio?.tapa ?? 1) - 1] ?? album.fotos[0],
      };
    });
    const propias = (meta?.coverflow ?? [])
      .map((f) => (typeof f === 'string' ? fotoDe(categoria.albums, f) : f))
      .filter((f) => !!f);
    const delAlbum = elegidas.length ? elegidas : todas.slice(0, 2);
    const portadas = delAlbum.length ? delAlbum : propias;
    const coverflow = propias.length ? propias : portadas;
    return {
      ...categoria,
      nombre: meta?.nombre ?? categoria.nombre,
      albums,
      icono: meta?.icono ?? 'camara',
      texto: meta?.texto ?? '',
      portadas,
      coverflow,
      tarjeta: meta?.tarjeta ?? coverflow[0],
      pase: meta?.pase,
      paseSueltas: meta?.paseSueltas ?? [],
    };
  },
);

// Orden del sitio: el de `categoriasMeta`; las carpetas sin datos van al final.
const posicion = (slug: string) => {
  const i = Object.keys(categoriasMeta).indexOf(slug);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};
categorias.sort((a, b) => posicion(a.slug) - posicion(b.slug));

export const categoria = (slug: string) => categorias.find((c) => c.slug === slug);

/** Foto por referencia "categoria/album:numero". */
export function foto(ref: string): Foto {
  const [slugCategoria, resto] = ref.split('/');
  const encontrada = fotoDe(categoria(slugCategoria)?.albums ?? [], resto);
  return encontrada ?? categorias[0].albums[0].fotos[0];
}

export const urlCategoria = (c: Categoria) => url(`portfolio/${c.slug}/`);
export const urlAlbum = (c: Categoria, a: Album) => url(`portfolio/${c.slug}/${a.slug}/`);

/**
 * Fotos del pase de la categoría, alternando entre álbumes: las de banner de
 * cada proyecto o, mientras no las tenga, sus fotos apaisadas.
 */
export function fotosDePase(c: Categoria, cantidad = 10) {
  const porAlbum = c.albums.map((album) => ({
    album,
    fotos: album.banners?.length ? album.banners : album.fotos.filter((f) => f.w > f.h),
  }));
  const elegidas: { foto: Foto; album: Album }[] = [];
  for (let vuelta = 0; elegidas.length < cantidad; vuelta++) {
    const deEstaVuelta = porAlbum.filter((p) => p.fotos[vuelta]);
    if (!deEstaVuelta.length) break;
    for (const p of deEstaVuelta) {
      if (elegidas.length < cantidad) elegidas.push({ foto: p.fotos[vuelta], album: p.album });
    }
  }
  return elegidas;
}

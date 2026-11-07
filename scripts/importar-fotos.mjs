// Importa las fotos de una carpeta con estructura Categoria/Album/*.jpg,
// las optimiza para web y genera src/data/galeria.json.
//
//   npm run fotos                         -> usa ~/Pictures/Web, 12 fotos por álbum
//   npm run fotos -- --max 0              -> todas las fotos de cada álbum
//   npm run fotos -- --origen "D:\Fotos"  -> otra carpeta de origen
//
// Las fotos sueltas dentro de una categoría (sin subcarpeta) forman un álbum
// con el mismo nombre que la categoría.
//
// Una subcarpeta "Banner" dentro de un proyecto tiene las fotos del pase de su
// categoría (2400 x 800). No se mezclan con las fotos del proyecto.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const { values } = parseArgs({
  options: {
    origen: { type: 'string', default: path.join(os.homedir(), 'Pictures', 'Web') },
    max: { type: 'string', default: '12' },
    forzar: { type: 'boolean', default: false },
  },
});

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = path.resolve(values.origen);
const MAX = Number(values.max);
const DESTINO = path.join(RAIZ, 'public', 'fotos');
const JSON_SALIDA = path.join(RAIZ, 'src', 'data', 'galeria.json');
const EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);
const GRANDE = 2000;
const MINIATURA = 800;
// Categorías (en slug) que están en la carpeta de origen pero no van al sitio.
const EXCLUIDAS = new Set(['naturaleza']);
const CARPETA_BANNER = 'banner';
const BANNER_GRANDE = 2400;
const BANNER_CHICO = 1600;
// Álbumes ("categoria/album", en slug) que se importan completos, sin el tope de --max.
const COMPLETOS = new Set([
  'infantiles/bauticumple-mateo',
  'eventos/sagrado-corazon',
  'eventos/streetcar-meet-3ra-edicion',
  'infantiles/bauticumple-ian',
  'infantiles/cumple-2-anos-bruno',
  'infantiles/sesion-facu',
  'recitales/ensayo-fralumalu',
  'productos/bijouterie',
]);

const orden = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

function slug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, 'n')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function listar(dir) {
  const entradas = await fs.readdir(dir, { withFileTypes: true });
  const carpetas = entradas.filter((e) => e.isDirectory()).map((e) => e.name).sort(orden.compare);
  const fotos = entradas
    .filter((e) => e.isFile() && EXTENSIONES.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort(orden.compare);
  return { carpetas, fotos };
}

// Toma `max` fotos repartidas a lo largo del álbum, no solo las primeras.
function muestrear(lista, max) {
  if (!max || lista.length <= max) return lista;
  return Array.from({ length: max }, (_, i) => lista[Math.floor((i * lista.length) / max)]);
}

async function enParalelo(tareas, limite = 4) {
  const resultados = new Array(tareas.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: limite }, async () => {
      while (siguiente < tareas.length) {
        const i = siguiente++;
        resultados[i] = await tareas[i]();
      }
    }),
  );
  return resultados;
}

async function procesarFoto(archivo, carpetaSalida, rutaWeb, nombre, grandeMax = GRANDE, chicoMax = MINIATURA) {
  const base = sharp(archivo).rotate();
  const grande = await base
    .clone()
    .resize({ width: grandeMax, height: grandeMax, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(carpetaSalida, `${nombre}.webp`));
  await base
    .clone()
    .resize({ width: chicoMax, height: chicoMax, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(path.join(carpetaSalida, `${nombre}-m.webp`));
  const { dominant } = await base.clone().resize(32).stats();
  return {
    src: `${rutaWeb}/${nombre}.webp`,
    thumb: `${rutaWeb}/${nombre}-m.webp`,
    w: grande.width,
    h: grande.height,
    color: `rgb(${dominant.r} ${dominant.g} ${dominant.b})`,
  };
}

const esBanner = (nombre) => nombre.toLowerCase() === CARPETA_BANNER;

async function carpetaBanner(dirAlbum) {
  const nombre = (await listar(dirAlbum)).carpetas.find(esBanner);
  return nombre ? path.join(dirAlbum, nombre) : null;
}

async function procesarAlbum(dirAlbum, nombre, slugCategoria, archivos) {
  const slugAlbum = slug(nombre);
  const carpetaSalida = path.join(DESTINO, slugCategoria, slugAlbum);
  await fs.mkdir(carpetaSalida, { recursive: true });
  const elegidas = COMPLETOS.has(`${slugCategoria}/${slugAlbum}`) ? archivos : muestrear(archivos, MAX);
  const rutaWeb = `fotos/${slugCategoria}/${slugAlbum}`;
  const dos = (i) => String(i + 1).padStart(2, '0');
  const fotos = await enParalelo(
    elegidas.map((archivo, i) => () => procesarFoto(path.join(dirAlbum, archivo), carpetaSalida, rutaWeb, dos(i))),
  );
  const dirBanner = await carpetaBanner(dirAlbum);
  const banners = await enParalelo(
    (dirBanner ? (await listar(dirBanner)).fotos : []).map((archivo, i) => () =>
      procesarFoto(path.join(dirBanner, archivo), carpetaSalida, rutaWeb, `banner-${dos(i)}`, BANNER_GRANDE, BANNER_CHICO),
    ),
  );
  console.log(`  ${nombre}: ${fotos.length} de ${archivos.length} fotos, ${banners.length} de banner`);
  return { slug: slugAlbum, nombre, total: archivos.length, fotos, banners };
}

if (!values.forzar) {
  console.error(
    'Este script borra todas las fotos de los álbumes (también las cargadas desde el panel) y las vuelve a importar.\n' +
      'Si es lo que querés, corré:  npm run fotos -- --forzar',
  );
  process.exit(1);
}

await fs.rm(DESTINO, { recursive: true, force: true });
const categorias = [];

for (const nombreCategoria of (await listar(ORIGEN)).carpetas) {
  const dirCategoria = path.join(ORIGEN, nombreCategoria);
  const slugCategoria = slug(nombreCategoria);
  if (EXCLUIDAS.has(slugCategoria)) continue;
  const { carpetas, fotos: sueltas } = await listar(dirCategoria);
  console.log(nombreCategoria);
  const albums = [];
  if (sueltas.length) {
    albums.push(await procesarAlbum(dirCategoria, nombreCategoria, slugCategoria, sueltas));
  }
  for (const nombreAlbum of carpetas.filter((c) => !esBanner(c))) {
    const dirAlbum = path.join(dirCategoria, nombreAlbum);
    const { fotos } = await listar(dirAlbum);
    if (fotos.length) albums.push(await procesarAlbum(dirAlbum, nombreAlbum, slugCategoria, fotos));
  }
  if (albums.length) categorias.push({ slug: slugCategoria, nombre: nombreCategoria, albums });
}

await fs.mkdir(path.dirname(JSON_SALIDA), { recursive: true });
await fs.writeFile(JSON_SALIDA, JSON.stringify({ categorias }, null, 2));
console.log(`\nListo: ${categorias.length} categorías -> ${path.relative(RAIZ, JSON_SALIDA)}`);

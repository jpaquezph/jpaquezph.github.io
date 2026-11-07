// Preparación de fotos en el navegador, antes de subirlas desde el panel: se
// achican, se recortan a la proporción de cada lugar y se pasan a WebP (o a JPG
// en los navegadores que no saben generar WebP). Hace lo mismo que el script
// importar-fotos con sharp, para que la web reciba siempre archivos livianos.

export interface FotoLista {
  grande: Blob;
  /** Versión liviana; no la llevan las fotos del pase. */
  chica?: Blob;
  ext: 'webp' | 'jpg';
  w: number;
  h: number;
  color: string;
  /** Aviso si la foto original no tenía la proporción esperada (se recortó al centro) o era más chica. */
  aviso?: string;
}

const CALIDAD = 0.8;

async function abrir(archivo: File) {
  try {
    // Respeta la orientación EXIF (fotos de celular giradas).
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`No se pudo abrir "${archivo.name}". Usá fotos JPG, PNG o WebP.`);
  }
}

function lienzo(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}

let webp: boolean | undefined;
async function soportaWebp() {
  if (webp === undefined) {
    const { c } = lienzo(2, 2);
    const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/webp', CALIDAD));
    webp = b?.type === 'image/webp';
  }
  return webp;
}

async function exportar(c: HTMLCanvasElement, ext: 'webp' | 'jpg') {
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, ext === 'webp' ? 'image/webp' : 'image/jpeg', CALIDAD));
  if (!blob) throw new Error('El navegador no pudo procesar la foto.');
  return blob;
}

/** Dibuja la región (sx, sy, sw, sh) de la imagen en un lienzo de w x h. */
function dibujar(img: ImageBitmap | HTMLCanvasElement, w: number, h: number, sx = 0, sy = 0, sw = img.width, sh = img.height) {
  const { c, ctx } = lienzo(w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c;
}

/** Color promedio, para el fondo que se ve mientras carga la foto. */
function colorDe(c: HTMLCanvasElement) {
  const { ctx } = lienzo(1, 1);
  ctx.drawImage(c, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r} ${g} ${b})`;
}

/** Foto de un lugar fijo de la web: se recorta al centro a la proporción ancho x alto. */
export async function prepararRecorte(archivo: File, medida: { ancho: number; alto: number; chico: number }): Promise<FotoLista> {
  const img = await abrir(archivo);
  const ext = (await soportaWebp()) ? 'webp' : 'jpg';
  const proporcion = medida.ancho / medida.alto;
  let sw = img.width;
  let sh = img.height;
  if (sw / sh > proporcion) sw = Math.round(sh * proporcion);
  else sh = Math.round(sw / proporcion);
  const avisos: string[] = [];
  if (Math.abs(img.width / img.height - proporcion) > 0.02) avisos.push('no tenía la proporción justa y se recortó al centro');
  if (img.width < medida.ancho * 0.9) avisos.push(`es más chica que lo ideal (${img.width} px de ancho, se recomiendan ${medida.ancho})`);
  // No se agranda: si la original es más chica, queda en su tamaño.
  const w = Math.min(medida.ancho, sw);
  const h = Math.round(w / proporcion);
  const grande = dibujar(img, w, h, Math.round((img.width - sw) / 2), Math.round((img.height - sh) / 2), sw, sh);
  img.close();
  const chica = medida.chico ? dibujar(grande, medida.chico, Math.round(medida.chico / proporcion)) : undefined;
  return {
    grande: await exportar(grande, ext),
    chica: chica && (await exportar(chica, ext)),
    ext,
    w,
    h,
    color: colorDe(grande),
    aviso: avisos.length ? `"${archivo.name}" ${avisos.join(' y ')}.` : undefined,
  };
}

/** Foto de álbum: entra en un cuadrado de `lado` sin recortar, más una versión chica. */
export async function prepararAlbum(archivo: File, medida: { lado: number; chico: number }): Promise<FotoLista> {
  const img = await abrir(archivo);
  const ext = (await soportaWebp()) ? 'webp' : 'jpg';
  const escala = (lado: number) => Math.min(1, lado / Math.max(img.width, img.height));
  const w = Math.round(img.width * escala(medida.lado));
  const h = Math.round(img.height * escala(medida.lado));
  const grande = dibujar(img, w, h);
  const chica = dibujar(img, Math.round(img.width * escala(medida.chico)), Math.round(img.height * escala(medida.chico)));
  img.close();
  return { grande: await exportar(grande, ext), chica: await exportar(chica, ext), ext, w, h, color: colorDe(grande) };
}

export async function aBase64(blob: Blob) {
  const datos = new Uint8Array(await blob.arrayBuffer());
  let texto = '';
  for (let i = 0; i < datos.length; i += 0x8000) texto += String.fromCharCode(...datos.subarray(i, i + 0x8000));
  return btoa(texto);
}

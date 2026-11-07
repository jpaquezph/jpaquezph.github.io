// Operaciones del panel de administración. Todas dependen de que la sesión sea
// de administrador: lo exigen las reglas de la base (supabase/admin.sql) y la
// función admin-usuarios, no este código.

import { bannerCliente as BANNER } from '../data/site';
import { esBanner, type Lineup } from './portal';
import { BUCKET, cliente, correoDe } from './supabase';

/** Error que sabe a qué campo o sección del formulario corresponde, para poder marcarlo. */
export class ErrorDeCampo extends Error {
  constructor(
    mensaje: string,
    readonly campo: string,
  ) {
    super(mensaje);
  }
}

/** Columnas editables de la tabla `eventos`. */
export interface DatosEvento {
  cliente: string;
  titulo: string;
  tipo: string;
  fecha: string;
  horario: string;
  lugar: string;
  direccion: string;
  paquete: string;
  estado: string;
  drive_url: string | null;
  entrega: string;
  /** Line-up del evento (la columna conserva el nombre original). */
  cronograma: Lineup;
  precio_total: number;
  pagos: { concepto: string; monto: number; fecha: string }[];
  vencimiento_saldo: string | null;
  incluye: string[];
  contrato_firmado: string | null;
  condiciones: string[];
}

export interface FilaEvento extends DatosEvento {
  id: string;
  user_id: string;
  usuario: string;
}

const archivos = cliente.storage.from(BUCKET);

function exigir<T>(resultado: { data: T; error: { message: string } | null }): T {
  if (resultado.error) throw new Error(resultado.error.message);
  return resultado.data;
}

async function usuarios(cuerpo: Record<string, string>) {
  const { data, error } = await cliente.functions.invoke('admin-usuarios', { body: cuerpo });
  if (!error) return data;
  // Cuando la función responde con un error, el detalle viene en el cuerpo de la respuesta.
  const respuesta = (error as { context?: Response }).context;
  const detalle = respuesta ? await respuesta.json().catch(() => null) : null;
  throw new Error(detalle?.error ?? 'No se pudo completar la operación con el usuario.');
}

export async function listarEventos() {
  return exigir(
    await cliente.from('eventos').select('id, user_id, usuario, cliente, titulo, fecha').order('fecha', { ascending: false }),
  ) as Pick<FilaEvento, 'id' | 'user_id' | 'usuario' | 'cliente' | 'titulo' | 'fecha'>[];
}

export async function obtenerEvento(id: string) {
  return exigir(await cliente.from('eventos').select('*').eq('id', id).single()) as FilaEvento;
}

/** Crea el usuario del cliente y su evento. Devuelve el evento creado. */
export async function crearCliente(usuario: string, clave: string, datos: DatosEvento) {
  const nombre = usuario.trim().toLowerCase();
  const { id } = await usuarios({ accion: 'crear', email: correoDe(nombre), clave }).catch((e: Error) => {
    const repetido = /already (been )?registered|already exists/i.test(e.message);
    throw new ErrorDeCampo(repetido ? `Ya existe un cliente con el usuario "${nombre}".` : e.message, 'usuario');
  });
  const alta = await cliente
    .from('eventos')
    .insert({ ...datos, user_id: id, usuario: nombre })
    .select('*')
    .single();
  if (alta.error) {
    // Sin evento, el usuario recién creado no sirve: se lo quita para poder reintentar.
    await usuarios({ accion: 'borrar', id }).catch(() => {});
    throw new Error(alta.error.message);
  }
  return alta.data as FilaEvento;
}

export async function guardarEvento(id: string, datos: DatosEvento) {
  return exigir(await cliente.from('eventos').update(datos).eq('id', id).select('*').single()) as FilaEvento;
}

export const cambiarClave = (userId: string, clave: string) => usuarios({ accion: 'clave', id: userId, clave });

export async function correoDeSesion() {
  const { data } = await cliente.auth.getSession();
  return data.session?.user.email ?? '';
}

/** Vuelve a pedirle la contraseña a quien tiene la sesión abierta, antes de una acción irreversible. */
export async function confirmarClave(clave: string) {
  const { data } = await cliente.auth.getUser();
  const email = data.user?.email;
  if (!email) return false;
  const { error } = await cliente.auth.signInWithPassword({ email, password: clave });
  return !error;
}

/** Borra el usuario, su evento y todos sus archivos. */
export async function borrarCliente(userId: string) {
  const { contrato, banner, destacadas } = await archivosDe(userId);
  const rutas = [contrato, banner, ...destacadas].filter((a) => a !== null).map((a) => a.ruta);
  if (rutas.length) exigir(await archivos.remove(rutas));
  await usuarios({ accion: 'borrar', id: userId });
}

// --- Archivos ---

export interface Archivo {
  ruta: string;
  nombre: string;
  enlace: string;
}

async function listar(carpeta: string): Promise<Archivo[]> {
  const lista = exigir(await archivos.list(carpeta, { sortBy: { column: 'name', order: 'asc' } }));
  const rutas = lista.filter((a) => a.id && !a.name.startsWith('.')).map((a) => `${carpeta}/${a.name}`);
  if (!rutas.length) return [];
  const firmados = exigir(await archivos.createSignedUrls(rutas, 3600));
  return rutas.map((ruta, i) => ({ ruta, nombre: ruta.split('/').pop()!, enlace: firmados[i]?.signedUrl ?? '' }));
}

/** El banner se guarda como <id>/banner-<marca de tiempo>.jpg; ver `esBanner` en portal.ts. */
export async function archivosDe(userId: string) {
  const [sueltos, destacadas] = await Promise.all([listar(userId), listar(`${userId}/destacadas`)]);
  return {
    contrato: sueltos.find((a) => a.nombre.toLowerCase().endsWith('.pdf')) ?? null,
    banner: sueltos.find((a) => esBanner(a.nombre)) ?? null,
    destacadas,
  };
}

export async function subirContrato(userId: string, archivo: File) {
  exigir(await archivos.upload(`${userId}/contrato.pdf`, archivo, { upsert: true, contentType: 'application/pdf' }));
}

const LADO_MAXIMO = 1800;

async function abrirImagen(archivo: File) {
  return createImageBitmap(archivo, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error(`No se pudo leer ${archivo.name}. Usá fotos JPG o PNG.`);
  });
}

// Achica la foto en el navegador antes de subirla, para no gastar el espacio del plan.
async function achicar(archivo: File, ladoMaximo = LADO_MAXIMO): Promise<Blob> {
  const imagen = await abrirImagen(archivo);
  const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  return new Promise((listo, fallo) =>
    lienzo.toBlob((blob) => (blob ? listo(blob) : fallo(new Error(`No se pudo procesar ${archivo.name}`))), 'image/jpeg', 0.85),
  );
}

export async function subirDestacadas(userId: string, fotos: File[], alAvanzar?: (hechas: number) => void) {
  const tanda = Date.now();
  for (const [i, foto] of fotos.entries()) {
    const nombre = `${tanda}-${String(i + 1).padStart(2, '0')}.jpg`;
    exigir(await archivos.upload(`${userId}/destacadas/${nombre}`, await achicar(foto), { contentType: 'image/jpeg' }));
    alAvanzar?.(i + 1);
  }
}

/**
 * Sube el banner y borra el anterior. Lleva la marca de tiempo en el nombre para que
 * nadie vea una versión vieja guardada en caché. Devuelve un aviso si la foto no es
 * la ideal (chica o poco apaisada); igual queda cargada.
 */
export async function subirBanner(userId: string, archivo: File) {
  const imagen = await abrirImagen(archivo);
  const { width: ancho, height: alto } = imagen;
  imagen.close();
  const anterior = (await archivosDe(userId)).banner;
  exigir(
    await archivos.upload(`${userId}/banner-${Date.now()}.jpg`, await achicar(archivo, BANNER.ancho), {
      contentType: 'image/jpeg',
    }),
  );
  if (anterior) await borrarArchivo(anterior.ruta);
  if (ancho < BANNER.anchoMinimo) {
    return `La foto mide ${ancho} × ${alto} px: en pantallas grandes se puede ver pixelada. Lo ideal es ${BANNER.ancho} × ${BANNER.alto}.`;
  }
  if (ancho / alto < 2) {
    return `La foto mide ${ancho} × ${alto} px: es poco apaisada y se le va a recortar bastante arriba y abajo. Lo ideal es ${BANNER.ancho} × ${BANNER.alto}.`;
  }
  return '';
}

export async function borrarArchivo(ruta: string) {
  exigir(await archivos.remove([ruta]));
}

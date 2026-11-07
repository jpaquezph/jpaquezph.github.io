// Área de clientes: de dónde salen el inicio de sesión y los datos del evento.
//
// Con la clave de Supabase cargada en src/data/site.ts se usa Supabase: cada
// cliente entra con el usuario que se le creó y solo puede leer su evento.
// Sin clave queda el modo demostración, con un usuario y un evento de ejemplo
// que viajan dentro del código del sitio (no sirve para datos reales).

import { condicionesGenerales } from '../data/site';
import { url } from './rutas';
import { BUCKET, cliente, correoDe, hayConexion } from './supabase';

export interface EventoCliente {
  cliente: string;
  titulo: string;
  tipo: string;
  /** Fecha del evento, AAAA-MM-DD. */
  fecha: string;
  horario: string;
  lugar: string;
  direccion: string;
  paquete: string;
  estado: string;
  /** Carpeta de Google Drive con las fotos; null mientras no estén entregadas. */
  driveUrl: string | null;
  entrega: string;
  destacadas: { src: string; thumb: string }[];
  /** Foto de fondo del encabezado; null si no se cargó. */
  bannerUrl: string | null;
  /** Line-up del evento. Se guarda en la columna `cronograma`. */
  cronograma: ItemLineup[];
  lineupEstado: EstadoLineup;
  precio: {
    total: number;
    pagos: { concepto: string; monto: number; fecha: string }[];
    vencimientoSaldo: string | null;
    incluye: string[];
  };
  /** PDF del contrato firmado; null si todavía no se cargó. */
  contratoUrl: string | null;
  contratoFirmado: string | null;
  condiciones: string[];
}

export interface ItemLineup {
  hora: string;
  titulo: string;
  detalle?: string;
}

/** 'a-confirmar': todavía no está cerrado. 'no-se-detalla': el evento no lo requiere. */
export type EstadoLineup = 'detallado' | 'a-confirmar' | 'no-se-detalla';

export interface Lineup {
  estado: EstadoLineup;
  items: ItemLineup[];
}

/** La columna guardaba antes solo la lista de momentos; se aceptan las dos formas. */
export function leerLineup(valor: unknown): Lineup {
  if (Array.isArray(valor)) return { estado: 'detallado', items: valor };
  const lineup = (valor ?? {}) as Partial<Lineup>;
  return { estado: lineup.estado ?? 'detallado', items: lineup.items ?? [] };
}

/** El banner del encabezado se guarda como <id>/banner-<marca de tiempo>.jpg. */
export const esBanner = (nombre: string) => /^banner-\d+\.jpg$/i.test(nombre.split('/').pop()!);

export interface Portal {
  /** false si el usuario o la contraseña no coinciden; lanza un error si falla la conexión. */
  ingresar(usuario: string, clave: string): Promise<boolean>;
  sesion(): Promise<boolean>;
  /** true si quien ingresó es el administrador (va al panel, no a un evento). */
  esAdmin(): Promise<boolean>;
  /** Evento del cliente con sesión iniciada; null si no hay sesión o todavía no se cargó. */
  evento(): Promise<EventoCliente | null>;
  salir(): Promise<void>;
}

// --- Supabase ---

const VIGENCIA_ENLACES = 60 * 60; // segundos

function crearPortalSupabase(): Portal {
  const archivos = cliente.storage.from(BUCKET);

  async function idUsuario() {
    const { data } = await cliente.auth.getSession();
    return data.session?.user.id ?? null;
  }

  // Los archivos de cada cliente están en una carpeta privada con su id:
  //   <id>/contrato.pdf, <id>/banner-*.jpg  y  <id>/destacadas/*.jpg
  // Se entregan con enlaces firmados que vencen.
  async function enlaces(rutas: string[]) {
    if (!rutas.length) return [];
    const { data, error } = await archivos.createSignedUrls(rutas, VIGENCIA_ENLACES);
    if (error) throw error;
    return data.map((d) => d.signedUrl).filter((u): u is string => !!u);
  }

  async function listar(carpeta: string) {
    const { data, error } = await archivos.list(carpeta, { sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    // Las subcarpetas vienen sin id; los marcadores de carpeta vacía empiezan con punto.
    return data.filter((a) => a.id && !a.name.startsWith('.')).map((a) => `${carpeta}/${a.name}`);
  }

  return {
    async ingresar(usuario, clave) {
      const { error } = await cliente.auth.signInWithPassword({ email: correoDe(usuario), password: clave });
      if (!error) return true;
      if (error.status === 400) return false;
      throw error;
    },

    async sesion() {
      return (await idUsuario()) !== null;
    },

    async esAdmin() {
      if (!(await idUsuario())) return false;
      const { data, error } = await cliente.rpc('es_admin');
      return !error && data === true;
    },

    async evento() {
      const id = await idUsuario();
      if (!id) return null;

      // Las reglas de la base ya impiden leer eventos ajenos; el filtro es para
      // el administrador, que puede verlos todos y no tiene uno propio.
      const { data: fila, error } = await cliente
        .from('eventos')
        .select('*')
        .eq('user_id', id)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!fila) return null;

      const lineup = leerLineup(fila.cronograma);
      const [sueltos, fotos] = await Promise.all([listar(id), listar(`${id}/destacadas`)]);
      const contrato = sueltos.find((ruta) => ruta.toLowerCase().endsWith('.pdf'));
      const banner = sueltos.find(esBanner);
      const [enlacesFotos, enlacesContrato, enlacesBanner] = await Promise.all([
        enlaces(fotos),
        enlaces(contrato ? [contrato] : []),
        enlaces(banner ? [banner] : []),
      ]);

      return {
        cliente: fila.cliente,
        titulo: fila.titulo,
        tipo: fila.tipo ?? '',
        fecha: fila.fecha,
        horario: fila.horario ?? '',
        lugar: fila.lugar ?? '',
        direccion: fila.direccion ?? '',
        paquete: fila.paquete ?? '',
        estado: fila.estado ?? '',
        // Solo enlaces https: cualquier otra cosa (p. ej. "javascript:") no se muestra.
        driveUrl: (fila.drive_url ?? '').toLowerCase().startsWith('https://') ? fila.drive_url : null,
        entrega: fila.entrega ?? '',
        destacadas: enlacesFotos.map((enlace) => ({ src: enlace, thumb: enlace })),
        bannerUrl: enlacesBanner[0] ?? null,
        cronograma: lineup.items,
        lineupEstado: lineup.estado,
        precio: {
          total: Number(fila.precio_total ?? 0),
          pagos: fila.pagos ?? [],
          vencimientoSaldo: fila.vencimiento_saldo ?? null,
          incluye: fila.incluye ?? [],
        },
        contratoUrl: enlacesContrato[0] ?? null,
        contratoFirmado: fila.contrato_firmado ?? null,
        condiciones: fila.condiciones?.length ? fila.condiciones : condicionesGenerales,
      };
    },

    async salir() {
      await cliente.auth.signOut();
    },
  };
}

// --- Demostración ---

export const DEMO = { usuario: 'demo', clave: 'demo2026' };

const SESION = 'jp-portal-demo';

const eventoDemo: EventoCliente = {
  cliente: 'Martina',
  titulo: 'Fiesta de egresados',
  tipo: 'Evento',
  fecha: '2026-12-12',
  horario: '21:00 a 05:00',
  lugar: 'Salón de ejemplo',
  direccion: 'Av. Siempreviva 742, Rosario',
  paquete: 'Evento completo',
  estado: 'Contrato firmado',
  driveUrl: 'https://drive.google.com/',
  entrega: 'Las fotos editadas se suben a esta carpeta dentro de los 20 días posteriores al evento.',
  destacadas: Array.from({ length: 8 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      src: url(`fotos/eventos/sagrado-corazon/${n}.webp`),
      thumb: url(`fotos/eventos/sagrado-corazon/${n}-m.webp`),
    };
  }),
  bannerUrl: url('fotos/eventos/sagrado-corazon/03.webp'),
  lineupEstado: 'detallado',
  cronograma: [
    { hora: '20:30', titulo: 'Llegada al salón', detalle: 'Fotos del lugar y la ambientación.' },
    { hora: '21:00', titulo: 'Recepción', detalle: 'Ingreso de invitados y fotos grupales.' },
    { hora: '22:30', titulo: 'Cena y brindis' },
    { hora: '00:00', titulo: 'Entrada y baile', detalle: 'Cobertura de pista.' },
    { hora: '05:00', titulo: 'Cierre' },
  ],
  precio: {
    total: 450000,
    pagos: [{ concepto: 'Seña', monto: 135000, fecha: '2026-10-05' }],
    vencimientoSaldo: '2026-12-10',
    incluye: ['Hasta 2 sesiones previas', 'Cobertura integral, sin límite de horario', 'Página de tu evento', 'Entrega digital'],
  },
  contratoUrl: null,
  contratoFirmado: '2026-10-05',
  condiciones: condicionesGenerales,
};

const demo: Portal = {
  async ingresar(usuario, clave) {
    const ok = usuario.trim().toLowerCase() === DEMO.usuario && clave === DEMO.clave;
    if (ok) sessionStorage.setItem(SESION, '1');
    return ok;
  },
  async sesion() {
    return sessionStorage.getItem(SESION) !== null;
  },
  async esAdmin() {
    return false;
  },
  async evento() {
    return sessionStorage.getItem(SESION) ? eventoDemo : null;
  },
  async salir() {
    sessionStorage.removeItem(SESION);
  },
};

export const esDemo = !hayConexion;
export const portal: Portal = esDemo ? demo : crearPortalSupabase();

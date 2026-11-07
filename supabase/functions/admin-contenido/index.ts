// Función de Supabase (Edge Function) que usa el panel de administración para
// cambiar las fotos y los álbumes de la web. Las fotos viven en el repositorio de
// GitHub: esta función hace los commits (subir, reemplazar y borrar archivos) y
// GitHub Actions vuelve a armar y publicar la web en un par de minutos.
//
// La llave de GitHub está solo acá, como secreto de Supabase: nunca llega al navegador.
// Solo responde si quien llama tiene sesión de administrador.
//
// Se carga desde el panel: Edge Functions > Deploy a new function > Via Editor,
// con el nombre  admin-contenido  y este archivo completo como contenido.
// Secretos (Edge Functions > Secrets):
//   GH_TOKEN  llave "fine-grained" de GitHub con permiso Contents: Read and write
//             y Actions: Read, solo sobre el repositorio de la web.
//   GH_REPO   usuario/repositorio, p. ej.  Jorgepaquez/jpaquezph
//   GH_RAMA   (opcional) rama que se publica; por defecto  main

import { createClient } from 'npm:@supabase/supabase-js@2';

// Sitios desde los que se puede usar el panel (los mismos que en admin-usuarios).
const ORIGENES = ['http://localhost:4321'];
const RED_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/;

// Qué puede tocar el panel en el repositorio: solo imágenes de public/ y los dos archivos de datos.
const RUTA_NUEVA = /^public\/(fotos\/[a-z0-9-]+\/[a-z0-9-]+|sitio)\/[a-z0-9-]+\.(webp|jpg)$/;
const RUTA_BORRABLE = /^public\/[a-z0-9_/-]+(\.[a-z0-9_-]+)*\.(webp|jpg|jpeg|png)$/i;
const DATOS = ['src/data/contenido.json', 'src/data/galeria.json'];
const MAX_FOTO = 8 * 1024 * 1024; // en base64
const MAX_DATOS = 3 * 1024 * 1024;
const MAX_ARCHIVOS = 60;

const origenPermitido = (origen: string | null) => !!origen && (ORIGENES.includes(origen) || RED_LOCAL.test(origen));

function cabeceras(origen: string | null) {
  return {
    'Access-Control-Allow-Origin': origenPermitido(origen) ? origen! : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

class ErrorGitHub extends Error {
  constructor(
    mensaje: string,
    readonly estado: number,
  ) {
    super(mensaje);
  }
}

function github(token: string, repo: string) {
  return async function llamar<T = any>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown; crudo?: boolean } = {}) {
    const respuesta = await fetch(`https://api.github.com/repos/${repo}${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: opciones.crudo ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'jpaquezph-panel',
        ...(opciones.cuerpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
    });
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      throw new ErrorGitHub(`GitHub respondió ${respuesta.status}: ${detalle.slice(0, 200)}`, respuesta.status);
    }
    return (opciones.crudo ? await respuesta.text() : await respuesta.json()) as T;
  };
}

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Controles mínimos de forma, para no publicar un archivo de datos que rompa la web. */
function datosValidos(ruta: string, valor: unknown) {
  if (!esObjeto(valor)) return false;
  if (ruta.endsWith('contenido.json')) {
    return esObjeto(valor.portada) && esObjeto(valor.categorias) && esObjeto(valor.albumes) && esObjeto(valor.destacado);
  }
  return Array.isArray(valor.categorias);
}

Deno.serve(async (pedido) => {
  const origen = pedido.headers.get('Origin');
  const responder = (cuerpo: unknown, estado = 200) =>
    new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras(origen) });

  if (pedido.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeceras(origen) });
  if (pedido.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);
  if (origen && !origenPermitido(origen)) return responder({ error: 'Origen no permitido.' }, 403);

  const url = Deno.env.get('SUPABASE_URL');
  const claveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = Deno.env.get('GH_TOKEN');
  const repo = Deno.env.get('GH_REPO');
  const rama = Deno.env.get('GH_RAMA') || 'main';
  if (!url || !claveServicio) return responder({ error: 'La función no tiene configurada la clave de servicio.' }, 500);
  const admin = createClient(url, claveServicio, { auth: { persistSession: false } });

  // Quién llama: se valida su sesión y que figure en la tabla de administradores.
  const sesion = (pedido.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!sesion) return responder({ error: 'Sesión vencida. Volvé a ingresar.' }, 401);
  const { data: quien } = await admin.auth.getUser(sesion);
  if (!quien?.user) return responder({ error: 'Sesión vencida. Volvé a ingresar.' }, 401);
  const { data: fila } = await admin.from('admins').select('user_id').eq('user_id', quien.user.id).maybeSingle();
  if (!fila) return responder({ error: 'No autorizado.' }, 403);
  const actor = quien.user.id;
  // Recién con el administrador identificado se informa si falta configurar GitHub.
  if (!token || !repo) return responder({ error: 'Falta configurar GH_TOKEN y GH_REPO en los secretos de la función.' }, 500);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await pedido.json();
  } catch {
    return responder({ error: 'Pedido inválido.' }, 400);
  }
  const gh = github(token, repo);

  try {
    // Estado actual de la web, leído del repositorio (siempre lo último, aunque no se haya publicado).
    if (cuerpo.accion === 'leer') {
      const [contenido, galeria] = await Promise.all(
        DATOS.map((ruta) => gh<string>(`/contents/${ruta}?ref=${rama}`, { crudo: true })),
      );
      return responder({ contenido: JSON.parse(contenido), galeria: JSON.parse(galeria) });
    }

    // Sube fotos como "blobs" de git (todavía sin commit). Devuelve su identificador.
    if (cuerpo.accion === 'subir') {
      const archivos = cuerpo.archivos;
      if (!Array.isArray(archivos) || !archivos.length || archivos.length > MAX_ARCHIVOS) {
        return responder({ error: 'No hay fotos para subir.' }, 400);
      }
      const subidos = [];
      for (const archivo of archivos) {
        const { ruta, base64 } = archivo ?? {};
        if (typeof ruta !== 'string' || !RUTA_NUEVA.test(ruta)) return responder({ error: `Ruta inválida: ${ruta}` }, 400);
        if (typeof base64 !== 'string' || !base64.length || base64.length > MAX_FOTO) {
          return responder({ error: 'Una foto es demasiado grande.' }, 400);
        }
        const blob = await gh<{ sha: string }>('/git/blobs', { metodo: 'POST', cuerpo: { content: base64, encoding: 'base64' } });
        subidos.push({ ruta, sha: blob.sha });
      }
      return responder({ subidos });
    }

    // Un solo commit con todo el cambio: fotos nuevas, archivos borrados y datos actualizados.
    if (cuerpo.accion === 'guardar') {
      const { mensaje, agregar = [], borrar = [], datos = {} } = cuerpo as {
        mensaje?: unknown;
        agregar?: { ruta: string; sha: string }[];
        borrar?: string[];
        datos?: Record<string, unknown>;
      };
      if (typeof mensaje !== 'string' || !mensaje.trim() || mensaje.length > 200) {
        return responder({ error: 'Falta la descripción del cambio.' }, 400);
      }
      if (!Array.isArray(agregar) || !Array.isArray(borrar) || !esObjeto(datos)) {
        return responder({ error: 'Pedido inválido.' }, 400);
      }
      for (const a of agregar) {
        if (!a || !RUTA_NUEVA.test(a.ruta) || !/^[0-9a-f]{40}$/.test(a.sha)) return responder({ error: 'Foto inválida.' }, 400);
      }
      for (const ruta of borrar) {
        if (typeof ruta !== 'string' || !RUTA_BORRABLE.test(ruta) || ruta.includes('..')) {
          return responder({ error: `No se puede borrar: ${ruta}` }, 400);
        }
      }
      const archivosDatos: { path: string; mode: '100644'; type: 'blob'; content: string }[] = [];
      for (const [ruta, valor] of Object.entries(datos)) {
        if (!DATOS.includes(ruta) || !datosValidos(ruta, valor)) return responder({ error: `Datos inválidos: ${ruta}` }, 400);
        const texto = JSON.stringify(valor, null, 2) + '\n';
        if (texto.length > MAX_DATOS) return responder({ error: 'Los datos son demasiado grandes.' }, 400);
        archivosDatos.push({ path: ruta, mode: '100644', type: 'blob', content: texto });
      }

      // Si alguien publicó otro cambio entremedio, se vuelve a armar sobre el último.
      for (let intento = 1; ; intento++) {
        const ref = await gh<{ object: { sha: string } }>(`/git/ref/heads/${rama}`);
        const padre = ref.object.sha;
        const commitPadre = await gh<{ tree: { sha: string } }>(`/git/commits/${padre}`);
        // Solo se borran archivos que existen: borrar uno inexistente hace fallar todo el commit.
        const arbol = await gh<{ tree: { path: string }[]; truncated: boolean }>(
          `/git/trees/${commitPadre.tree.sha}?recursive=1`,
        );
        const existentes = new Set(arbol.tree.map((t) => t.path));
        const nuevoArbol = await gh<{ sha: string }>('/git/trees', {
          metodo: 'POST',
          cuerpo: {
            base_tree: commitPadre.tree.sha,
            tree: [
              ...agregar.map((a) => ({ path: a.ruta, mode: '100644', type: 'blob', sha: a.sha })),
              ...borrar
                .filter((r) => arbol.truncated || existentes.has(r))
                .map((r) => ({ path: r, mode: '100644', type: 'blob', sha: null })),
              ...archivosDatos,
            ],
          },
        });
        const commit = await gh<{ sha: string }>('/git/commits', {
          metodo: 'POST',
          cuerpo: { message: `Panel: ${mensaje.trim()}`, tree: nuevoArbol.sha, parents: [padre] },
        });
        try {
          await gh(`/git/refs/heads/${rama}`, { metodo: 'PATCH', cuerpo: { sha: commit.sha, force: false } });
        } catch (e) {
          if (e instanceof ErrorGitHub && e.estado === 422 && intento < 3) continue;
          throw e;
        }
        await admin
          .from('auditoria')
          .insert({
            actor,
            accion: 'contenido.guardar',
            objetivo: commit.sha,
            detalle: { mensaje: mensaje.trim(), agregados: agregar.length, borrados: borrar },
          })
          .then(() => {}, () => {});
        return responder({ commit: commit.sha });
      }
    }

    // Cómo va la publicación del último cambio (GitHub Actions).
    if (cuerpo.accion === 'estado') {
      const { workflow_runs: corridas } = await gh<{
        workflow_runs: { status: string; conclusion: string | null; head_sha: string; updated_at: string; html_url: string }[];
      }>(`/actions/runs?branch=${rama}&per_page=1`);
      const ultima = corridas[0];
      return responder(
        ultima
          ? { estado: ultima.status, resultado: ultima.conclusion, commit: ultima.head_sha, cuando: ultima.updated_at, enlace: ultima.html_url }
          : { estado: 'sin-datos' },
      );
    }

    return responder({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    const texto = e instanceof Error ? e.message : String(e);
    console.error(texto);
    if (e instanceof ErrorGitHub && (e.estado === 401 || e.estado === 403)) {
      return responder({ error: 'GitHub rechazó la llave (GH_TOKEN). Revisá que no haya vencido y que tenga permisos sobre el repositorio.' }, 502);
    }
    return responder({ error: 'No se pudo completar el cambio en GitHub. Probá de nuevo en un momento.' }, 502);
  }
});

// Función de Supabase (Edge Function) que usa el panel de administración para
// crear clientes, cambiarles la contraseña y borrarlos. Corre en los servidores
// de Supabase, que es el único lugar donde puede estar la clave con acceso total.
// Solo responde si quien llama tiene sesión de administrador.
//
// Se carga desde el panel: Edge Functions > Deploy a new function > Via Editor,
// con el nombre  admin-usuarios  y este archivo completo como contenido.
// Requiere haber ejecutado supabase/seguridad.sql (tabla de auditoría).

import { createClient } from 'npm:@supabase/supabase-js@2';

// Sitios desde los que se puede usar el panel. Cuando la web se publique,
// agregar acá su dirección (p. ej. 'https://jpaquezph.github.io').
const ORIGENES = ['http://localhost:4321'];
// En desarrollo también se acepta la red de la casa (para probar desde el celular).
const RED_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/;

// Los clientes solo pueden ser mails del formato que usa la web: casilla+usuario@gmail.com.
const CORREO_CLIENTE = /^jpaquezph\.clientes\+[a-z0-9][a-z0-9._-]{0,39}@gmail\.com$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAVE_MINIMA = 10;
const CLAVE_MAXIMA = 72;

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

const claveValida = (clave: unknown): clave is string =>
  typeof clave === 'string' && clave.length >= CLAVE_MINIMA && clave.length <= CLAVE_MAXIMA;

Deno.serve(async (pedido) => {
  const origen = pedido.headers.get('Origin');
  const responder = (cuerpo: unknown, estado = 200) =>
    new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras(origen) });

  if (pedido.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeceras(origen) });
  if (pedido.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);
  if (origen && !origenPermitido(origen)) return responder({ error: 'Origen no permitido.' }, 403);

  const url = Deno.env.get('SUPABASE_URL');
  const claveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await pedido.json();
  } catch {
    return responder({ error: 'Pedido inválido.' }, 400);
  }
  const { accion, email, clave, id } = cuerpo;

  // Deja constancia de cada operación (tabla public.auditoria, solo visible desde el panel de Supabase).
  const registrar = (detalle: string, objetivo: unknown) =>
    admin
      .from('auditoria')
      .insert({ actor, accion: `usuario.${detalle}`, objetivo: String(objetivo ?? '') })
      .then(() => {}, () => {});

  if (accion === 'crear') {
    if (typeof email !== 'string' || !CORREO_CLIENTE.test(email.toLowerCase())) {
      return responder({ error: 'El usuario solo puede tener letras, números, puntos o guiones.' }, 400);
    }
    if (!claveValida(clave)) {
      return responder({ error: `La contraseña necesita entre ${CLAVE_MINIMA} y ${CLAVE_MAXIMA} caracteres.` }, 400);
    }
    const { data, error } = await admin.auth.admin.createUser({ email: email.toLowerCase(), password: clave, email_confirm: true });
    if (error) return responder({ error: error.message }, 400);
    await registrar('crear', data.user.id);
    return responder({ id: data.user.id });
  }

  if (accion !== 'clave' && accion !== 'borrar') return responder({ error: 'Acción desconocida.' }, 400);
  if (typeof id !== 'string' || !UUID.test(id)) return responder({ error: 'Cliente inválido.' }, 400);

  // Un administrador no se puede modificar ni borrar desde la web.
  const { data: esAdmin } = await admin.from('admins').select('user_id').eq('user_id', id).maybeSingle();
  if (esAdmin) return responder({ error: 'Esa cuenta es de administrador.' }, 400);

  if (accion === 'clave') {
    if (!claveValida(clave)) {
      return responder({ error: `La contraseña necesita entre ${CLAVE_MINIMA} y ${CLAVE_MAXIMA} caracteres.` }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password: clave });
    if (error) return responder({ error: error.message }, 400);
    // Cierra las sesiones abiertas de ese cliente con la contraseña anterior.
    await admin.rpc('cerrar_sesiones', { uid: id }).then(() => {}, () => {});
    await registrar('clave', id);
    return responder({ ok: true });
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return responder({ error: error.message }, 400);
  await registrar('borrar', id);
  return responder({ ok: true });
});

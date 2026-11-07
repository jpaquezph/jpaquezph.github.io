// Respaldo de los clientes desde el panel. El plan gratis de Supabase no hace
// copias de seguridad: con esto queda una copia en la compu del administrador.

import { archivosDe } from './admin';
import { cliente } from './supabase';

const hoy = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD

function bajar(nombre: string, tipo: string, contenido: string) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000);
}

async function eventos() {
  const { data, error } = await cliente.from('eventos').select('*').order('fecha', { ascending: false });
  if (error) throw new Error(`No se pudieron leer los eventos: ${error.message}`);
  return data as Record<string, unknown>[];
}

/**
 * Respaldo completo: todos los datos de cada evento y la lista de sus archivos
 * (contrato, banner y fotos destacadas). Los archivos en sí siguen en Supabase.
 */
export async function descargarRespaldo() {
  const lista = await eventos();
  const conArchivos = await Promise.all(
    lista.map(async (e) => {
      const { contrato, banner, destacadas } = await archivosDe(String(e.user_id));
      const archivos = [contrato, banner, ...destacadas].filter((a) => !!a).map((a) => a.ruta);
      return { ...e, archivos };
    }),
  );
  const respaldo = {
    descripcion: 'Respaldo de clientes y eventos de jpaquezph (tabla eventos de Supabase).',
    creado: new Date().toISOString(),
    eventos: conArchivos,
  };
  bajar(`respaldo-clientes-${hoy()}.json`, 'application/json', JSON.stringify(respaldo, null, 2));
  return conArchivos.length;
}

/** Planilla para abrir con Excel: una fila por evento con lo principal. */
export async function descargarPlanilla() {
  const lista = await eventos();
  const columnas: [string, (e: Record<string, unknown>) => unknown][] = [
    ['Usuario', (e) => e.usuario],
    ['Cliente', (e) => e.cliente],
    ['Evento', (e) => e.titulo],
    ['Tipo', (e) => e.tipo],
    ['Fecha', (e) => e.fecha],
    ['Horario', (e) => e.horario],
    ['Lugar', (e) => e.lugar],
    ['Dirección', (e) => e.direccion],
    ['Paquete', (e) => e.paquete],
    ['Estado', (e) => e.estado],
    ['Total', (e) => e.precio_total],
    ['Pagado', (e) => pagado(e)],
    ['Saldo', (e) => Number(e.precio_total ?? 0) - pagado(e)],
    ['Vence el saldo', (e) => e.vencimiento_saldo],
    ['Contrato firmado', (e) => e.contrato_firmado],
    ['Carpeta de Drive', (e) => e.drive_url],
  ];
  // Excel en español usa ";" como separador; el BOM hace que lea bien los acentos.
  const celda = (v: unknown) => {
    const texto = v === null || v === undefined ? '' : String(v);
    // Una celda que empieza con = + - @ la tomaría como fórmula.
    const seguro = /^[=+\-@]/.test(texto) && Number.isNaN(Number(texto)) ? `'${texto}` : texto;
    return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  const filas = [columnas.map(([titulo]) => titulo), ...lista.map((e) => columnas.map(([, valor]) => valor(e)))];
  bajar(`clientes-${hoy()}.csv`, 'text/csv;charset=utf-8', '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n'));
  return lista.length;
}

function pagado(e: Record<string, unknown>) {
  const pagos = Array.isArray(e.pagos) ? (e.pagos as { monto?: number }[]) : [];
  return pagos.reduce((suma, p) => suma + (Number(p.monto) || 0), 0);
}

import { createClient } from '@supabase/supabase-js';
import { supabase as config } from '../data/site';

export const hayConexion = !!config.clave;

// Sin clave no se hace ninguna consulta: el área de clientes queda en modo demostración.
export const cliente = createClient(config.url, config.clave || 'sin-clave');

/** Espacio privado con una carpeta por cliente: <id>/contrato.pdf y <id>/destacadas/*. */
export const BUCKET = 'clientes';

/** Mail con el que está dado de alta en Supabase quien escribe `usuario` al ingresar. */
export function correoDe(usuario: string) {
  const limpio = usuario.trim().toLowerCase();
  if (limpio.includes('@')) return limpio;
  const [casilla, dominio] = config.correoUsuarios.split('@');
  return `${casilla}+${limpio}@${dominio}`;
}

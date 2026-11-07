// Puerta de las páginas del panel: solo el administrador las ve; el resto vuelve al ingreso.
import { portal } from './portal';
import { url } from './rutas';

import { NO_CONTAR } from './visitas';

export async function exigirAdmin(panel: HTMLElement) {
  const admin = await portal.esAdmin().catch(() => false);
  if (!admin) {
    location.replace(url('clientes/'));
    return false;
  }
  try {
    localStorage.setItem(NO_CONTAR, '1');
  } catch {
    // Sin almacenamiento (modo privado): sus visitas se cuentan como las de cualquiera.
  }
  panel.hidden = false;
  return true;
}

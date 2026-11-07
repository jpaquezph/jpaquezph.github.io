// Aviso de cómo va la publicación de la web después de guardar un cambio en el panel.
import { estadoPublicacion } from './admin-contenido';

let temporizador: ReturnType<typeof setTimeout> | undefined;

/**
 * Consulta GitHub Actions y muestra el estado en `aviso`; mientras publica, vuelve
 * a mirar cada 10 s. Con `commit`, espera a que arranque la publicación de ese cambio.
 */
export async function seguirPublicacion(aviso: HTMLElement, commit?: string, intentos = 0) {
  clearTimeout(temporizador);
  const mostrar = (texto: string, tipo: 'info' | 'ok' | 'error') => {
    aviso.hidden = false;
    aviso.dataset.tipo = tipo;
    aviso.textContent = texto;
  };
  const otraVez = (espera: number) => {
    temporizador = setTimeout(() => seguirPublicacion(aviso, commit, intentos + 1), espera);
  };
  try {
    const e = await estadoPublicacion();
    if (commit && e.commit !== commit) {
      // Actions tarda unos segundos en tomar el commit nuevo.
      if (intentos > 18) return mostrar('Guardado. La publicación todavía no arrancó; revisá en unos minutos.', 'info');
      mostrar('Guardado. Arrancando la publicación…', 'info');
      return otraVez(6_000);
    }
    if (e.estado === 'completed' && e.resultado === 'success') {
      mostrar('La web está publicada con los últimos cambios.', 'ok');
    } else if (e.estado === 'completed') {
      mostrar('La última publicación falló. Los cambios están guardados, pero la web no se actualizó todavía.', 'error');
    } else if (e.estado === 'sin-datos') {
      aviso.hidden = true;
    } else {
      mostrar('Publicando los cambios en la web… Tarda 2 o 3 minutos; podés seguir trabajando.', 'info');
      otraVez(10_000);
    }
  } catch {
    aviso.hidden = true;
  }
}

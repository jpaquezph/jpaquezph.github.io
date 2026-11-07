// Armado de elementos para las páginas del panel. Todo texto entra como texto
// (nunca como HTML), así un título o un nombre de archivo no puede inyectar código.

import { svgIcono } from '../data/iconos';

type Hijo = Node | string | number | null | undefined | false;
type Atributos = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(etiqueta: K, atributos: Atributos = {}, ...hijos: Hijo[]) {
  const el = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (typeof valor === 'function') el.addEventListener(nombre.replace(/^on/, ''), valor);
    else if (valor === true) el.setAttribute(nombre, '');
    else el.setAttribute(nombre, String(valor));
  }
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(typeof hijo === 'number' ? String(hijo) : hijo);
  }
  return el;
}

/** Ícono del sitio (mismos dibujos que el componente Icon). */
export function icono(nombre: string, tam = 16) {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = svgIcono(nombre, tam); // SVG de una lista fija del propio código
  return plantilla.content.firstElementChild!;
}

/** Abre el selector de archivos y devuelve las fotos elegidas (vacío si se cancela). */
export function elegirFotos(varias = false): Promise<File[]> {
  return new Promise((listo) => {
    const entrada = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: varias });
    entrada.addEventListener('change', () => listo([...(entrada.files ?? [])]));
    entrada.addEventListener('cancel', () => listo([]));
    entrada.click();
  });
}

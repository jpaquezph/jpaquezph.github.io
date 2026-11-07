// Íconos de línea (24x24). Se usan desde Icon.astro y desde scripts del navegador.

const trazos: Record<string, string> = {
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  izquierda: '<path d="M15 5l-7 7 7 7"/>',
  derecha: '<path d="M9 5l7 7-7 7"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  arriba:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  instagram:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>',
  youtube:
    '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.2 9.3v5.4l4.6-2.7z" fill="currentColor"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  whatsapp:
    '<path d="M3.6 20.4l1.2-4.4a8.4 8.4 0 1 1 3.3 3.2z"/><path d="M9.2 8.3c-.5 1 .2 2.900 1.700 4.400s3.400 2.200 4.400 1.700l.6-1.100-1.900-1.100-.9.8c-.8-.4-1.500-1.100-1.900-1.900l.8-.9-1.100-1.900z"/>',
  camara:
    '<path d="M4 8h3l1.500-2.200h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.3" r="3.600"/>',
  rayo: '<path d="M13 3L5 13.500h6L10 21l8-10.500h-6z"/>',
  escudo: '<path d="M12 3l7.500 3v5.500c0 4.500-3 8-7.500 9.500-4.500-1.500-7.500-5-7.500-9.500V6z"/><path d="M9 12l2.200 2.200 4-4.200"/>',
  corazon:
    '<path d="M12 20.300S4.200 15.700 4.200 9.900A4.200 4.200 0 0 1 12 7.600a4.200 4.200 0 0 1 7.800 2.300c0 5.800-7.800 10.400-7.800 10.400z"/>',
  musica: '<path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/>',
  copa: '<path d="M6 4h12l-6 8zM12 12v7.500M8.500 19.500h7"/>',
  retrato: '<circle cx="12" cy="8.800" r="3.600"/><path d="M5 20c.8-3.600 3.600-5.600 7-5.600s6.200 2 7 5.600"/>',
  montana: '<path d="M2.500 19l6.500-10.500 4 6 2.500-3.500 6 8z"/>',
  candado: '<rect x="5" y="11" width="14" height="9.500" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  carpeta: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  descarga: '<path d="M12 4v11M7.500 11l4.500 4.500 4.500-4.500M5 20h14"/>',
  reloj: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  calendario: '<rect x="4" y="5.500" width="16" height="14.500" rx="2"/><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4"/>',
  pin: '<path d="M12 21s-6.500-6-6.500-11a6.500 6.500 0 0 1 13 0c0 5-6.500 11-6.500 11z"/><circle cx="12" cy="10" r="2.300"/>',
  documento:
    '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  precio: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.500"/>',
  salir: '<path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H10"/>',
};

export function svgIcono(nombre: string, tam = 20): string {
  return `<svg class="icono" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.500" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazos[nombre] ?? ''}</svg>`;
}

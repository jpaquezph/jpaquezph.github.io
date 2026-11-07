// Pasar fotos deslizando el dedo (o arrastrando con el mouse) hacia los costados.
// El elemento necesita `touch-action: pan-y pinch-zoom` en el CSS: así el navegador
// sigue haciendo el scroll vertical y el zoom con dos dedos, y el gesto de costado
// queda para pasar la foto.

const UMBRAL = 40; // px mínimos para tomarlo como deslizamiento

export function alDeslizar(elemento: HTMLElement, acciones: { anterior: () => void; siguiente: () => void }) {
  let inicio: { x: number; y: number; id: number } | null = null;
  let deslizo = false;

  elemento.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    inicio = { x: e.clientX, y: e.clientY, id: e.pointerId };
    deslizo = false;
  });

  const terminar = (e: PointerEvent) => {
    if (!inicio || e.pointerId !== inicio.id) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    inicio = null;
    // Solo cuenta si fue claramente de costado: un scroll hacia abajo no pasa la foto.
    if (Math.abs(dx) < UMBRAL || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    deslizo = true;
    if (dx < 0) acciones.siguiente();
    else acciones.anterior();
  };
  elemento.addEventListener('pointerup', terminar);
  elemento.addEventListener('pointercancel', () => (inicio = null));

  // El clic que sigue a un deslizamiento no abre enlaces ni toca botones.
  elemento.addEventListener(
    'click',
    (e) => {
      if (!deslizo) return;
      deslizo = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    { capture: true },
  );
  // Que el navegador no "arrastre" la imagen como archivo al deslizar con el mouse.
  elemento.addEventListener('dragstart', (e) => e.preventDefault());
}

import { defineConfig } from 'astro/config';

// Proyecto de Supabase del área de clientes (el mismo que figura en src/data/site.ts).
const SUPABASE = 'https://jfuhhybljhzjslvzjzrm.supabase.co';

// En GitHub Pages el sitio suele quedar en https://usuario.github.io/repo/.
// Para ese caso: BASE_PATH=/repo SITE_URL=https://usuario.github.io npm run build
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH ?? '/',
  // Sin la barra flotante de herramientas de Astro en modo desarrollo.
  devToolbar: { enabled: false },
  // Política de seguridad de contenido (CSP). Astro agrega a cada página un <meta>
  // con los hashes de sus propios scripts y estilos, así que el navegador solo
  // ejecuta el código del sitio: un script inyectado (XSS) no corre, y la página
  // solo puede hablar con el propio sitio y con Supabase.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        `connect-src 'self' ${SUPABASE}`,
        `img-src 'self' data: blob: ${SUPABASE}`,
        "font-src 'self'",
        'frame-src https://www.openstreetmap.org',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
      // Atributos style="" sueltos (colores de carga de las fotos, posiciones).
      styleDirective: { resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }] },
    },
  },
});

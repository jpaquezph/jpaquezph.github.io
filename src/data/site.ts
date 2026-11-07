import contenido from './contenido.json';

// Textos y datos del sitio. Contacto, presentación y recorrido salen del portfolio
// personal; precios y testimonios siguen siendo de relleno.

export const sitio = {
  marca: 'JP',
  nombre: 'Jorge',
  nombreCompleto: 'Jorge Paquéz',
  bajada: 'Fotografía de eventos',
  ciudad: 'Rosario, Argentina',
  descripcion:
    'Jorge Paquéz, fotografía de eventos en Rosario: eventos, recitales, sesiones e infantiles. Momentos reales, historias únicas.',
  // Número en formato internacional, sin + ni espacios.
  whatsapp: '5493417184601',
  instagram: 'https://www.instagram.com/jpaquezph',
  youtube: 'https://www.youtube.com/@jpaquezph',
  email: 'jorge.paquez@gmail.com',
};

// Área de clientes. La URL y la clave "publishable" son públicas por diseño:
// lo que protege los datos son las reglas de la base (supabase/esquema.sql).
// Mientras `clave` esté vacía, el área de clientes funciona en modo demostración.
export const supabase = {
  url: 'https://jfuhhybljhzjslvzjzrm.supabase.co',
  clave: 'sb_publishable_RFyn5LwiGcvYBHJywyBszw_8HPhm9OT',
  // El cliente escribe solo su usuario (ej. "martina15"). En Supabase está dado
  // de alta como jpaquezph.clientes+martina15@gmail.com: todo lo que va después
  // del + llega a esta misma casilla.
  correoUsuarios: 'jpaquezph.clientes@gmail.com',
};

// Medidas del banner del encabezado de la página de cada cliente: las mismas que los
// banners de los proyectos. Se muestran como guía en el panel de administración.
export const bannerCliente = { ancho: 2400, alto: 800, anchoMinimo: 1600 };

// Se muestran en la página de cada cliente cuando su evento no tiene condiciones propias.
export const condicionesGenerales = [
  'La fecha queda reservada con el pago de la seña.',
  'El saldo se abona hasta 48 horas antes del evento.',
  'Cambios de fecha u horario sujetos a disponibilidad, con al menos 15 días de aviso.',
  'La entrega se realiza por Google Drive dentro de los 20 días posteriores al evento.',
  'Las fotos pueden usarse en portfolio y redes salvo pedido expreso en contrario.',
];

export const menu = [
  { texto: 'Inicio', ruta: '' },
  { texto: 'Portfolio', ruta: 'portfolio/' },
  { texto: 'Sobre mí', ruta: 'sobre-mi/' },
  { texto: 'Contacto', ruta: 'contacto/' },
];

// Fotos y textos que se cambian desde el panel de administración (pestañas "Fotos
// de la web" y "Álbumes"): viven en contenido.json para que el panel pueda editarlos.
// Las fotos son archivos de public/ (versión grande y chica).
export type FotoPropia = { src: string; thumb: string; w: number; h: number; color: string };

// Datos extra por categoría, según el nombre de la carpeta (en slug).
// `portadas` son referencias "album:numero-de-foto"; la primera es la principal.
// `coverflow` (opcional) son las fotos del carrusel de categorías de la portada, una
// por vuelta: archivos propios o referencias "album:numero-de-foto".
// `nombre` reemplaza al de la carpeta; hace falta en las categorías sin carpeta de fotos.
export interface MetaCategoria {
  nombre?: string;
  icono: string;
  texto: string;
  portadas: string[];
  coverflow?: (FotoPropia | string)[];
  /** Tarjeta de la categoría en la página Portfolio (3:4). */
  tarjeta?: FotoPropia;
  /** Primera foto del pase de la categoría (1180 x 320). */
  pase?: FotoPropia;
  /** Fotos del pase por proyecto: { "slug-del-album": [fotos] }. */
  banners?: Record<string, FotoPropia[]>;
  /** Fotos del pase que no son de un proyecto publicado; llevan a los proyectos. */
  paseSueltas?: FotoPropia[];
}
export const categoriasMeta = contenido.categorias as Record<string, MetaCategoria>;

// Nombre y bajada con que se muestra cada proyecto, por "categoria/carpeta" (en slug).
// Los que no figuran acá se muestran con el nombre de su carpeta.
// `tapa` (opcional): número de foto del álbum que va en su tarjeta; si no está, la primera.
export const albumesMeta = contenido.albumes as Record<string, { titulo: string; descripcion: string; tapa?: number }>;

export const sobreMi = {
  // Bloque de la página principal.
  resumen: [
    'Soy de Rosario, Santa Fe, Argentina. La fotografía es mi verdadera pasión. Cursé la tecnicatura superior en fotografía y le sumé cursos y especializaciones.',
    'Lo que más me gusta de este trabajo es guardar momentos que no se repiten: un abrazo, una risa, una mirada. Con los años, esas fotos son la forma de volver a ese día.',
  ],
  // Página Sobre mí.
  perfil: [
    '¡Hola! Mi nombre es Jorge y soy de Rosario, Santa Fe, Argentina. Me apasiona la fotografía: la cursé como carrera terciaria y le sumé cursos y especializaciones que me dieron herramientas concretas para trabajar en rubros muy distintos.',
    'Trabajé en fotografía de eventos sociales y empresariales, publicitaria, de productos e inmobiliaria. Hoy sigo adelante con mi verdadera pasión cubriendo eventos, recitales y sesiones.',
  ],
  experiencia: [
    {
      titulo: 'Fotógrafo autónomo',
      lugar: 'Estudio freelance Pedeefe, Rosario',
      periodo: 'Febrero 2017 – 2023',
      detalle:
        'Fotografía de eventos sociales y empresariales, fotografía de productos, catálogos, producciones fotográficas y audiovisuales.',
    },
    { titulo: 'Fotógrafo publicitario', lugar: 'Club Publicitario, Rosario', periodo: 'Junio 2021 – junio 2022', detalle: '' },
    {
      titulo: 'Fotógrafo inmobiliario',
      lugar: 'Dunod S.A., Rosario',
      periodo: 'Abril 2015 – octubre 2016',
      detalle: 'Fotografía de inmuebles y relaciones internas. Producciones audiovisuales.',
    },
    {
      titulo: 'Voluntario',
      lugar: 'Sociedad de Fotógrafos Profesionales de Rosario (SFPR)',
      periodo: 'Mayo 2014 – octubre 2015',
      detalle: 'Relevamientos audiovisuales.',
    },
  ],
  formacion: [
    { titulo: 'Técnico superior en fotografía', lugar: 'ISET N.° 18, Rosario', periodo: '2014 · hasta 2.º año', detalle: '' },
    {
      titulo: 'Expositor en el concurso municipal de fotografía',
      lugar: 'Rosario',
      periodo: 'Agosto – septiembre 2013',
      detalle:
        'Tercer puesto en la muestra «Recorrida por el cementerio», expuesta en las inmediaciones del cementerio El Salvador.',
    },
    {
      titulo: 'Relevamiento fotográfico',
      lugar: 'Universidad Nacional de Rosario (UNR)',
      periodo: '2019',
      detalle: 'Registro de un simulacro de catástrofe en eventos deportivos. Reconocido por Resolución 0830.',
    },
    {
      titulo: 'Cursos de fotografía',
      lugar: 'Retratos, Photoshop, iluminación, retoque de moda, retoque publicitario y Lightroom.',
      periodo: '',
      detalle: '',
    },
  ],
};

// Banner principal (`hero`) y foto del bloque Sobre mí. `heroFocoCelular`: en celular la
// portada se recorta en vertical; qué punto de la foto queda a la vista (50% es el centro).
export const portada = contenido.portada as {
  hero: FotoPropia;
  heroFocoCelular: string;
  sobreMi: FotoPropia;
};

// Trabajo destacado de la portada: álbum y números de sus fotos.
export const destacado = contenido.destacado as {
  categoria: string;
  album: string;
  titulo: string;
  texto: string;
  fotos: number[];
};

export const cualidades = [
  { icono: 'camara', titulo: 'Profesionalismo', texto: 'Puntualidad, buen trato y comunicación clara.' },
  { icono: 'rayo', titulo: 'Edición cuidada', texto: 'Cada foto importa y se edita con cuidado, una por una.' },
  { icono: 'escudo', titulo: 'Compromiso', texto: 'Dedicación, responsabilidad y entrega en fecha.' },
  { icono: 'corazon', titulo: 'Pasión por lo que hago', texto: 'Porque cada evento es único.' },
];

export const precios = {
  // Cartel de promoción arriba de los precios; dejarlo vacío para no mostrarlo.
  promo: 'Código de descuento: JPHWEB10',
  nota: 'Cada trabajo se cotiza a medida según tu necesidad.',
  mensajeWhatsapp: 'Hola Jorge, quiero pedir una cotización.',
  // Los precios no se muestran en el sitio: solo proponen el total al cargar un evento en el panel admin.
  planes: [
    {
      nombre: 'Sesión de exterior',
      precio: 65000,
      texto: 'Retratos, 15 años, embarazo o familia.',
      incluye: ['Rosario y alrededores', 'Entrega digital', 'Sesiones desde 1 hora'],
      destacado: true,
    },
    {
      nombre: 'Productos',
      precio: 180000,
      texto: 'Fotografía de productos y catálogos.',
      incluye: ['Estudio o en locación', 'Presupuesto por productos', 'Entrega digital'],
      destacado: true,
    },
    {
      nombre: 'Evento completo',
      precio: 300000,
      texto: 'Evento + sesión.',
      incluye: [
        'Hasta 2 sesiones previas',
        'Cobertura integral, sin límite de horario',
        'Página de tu evento',
        'Entrega digital',
      ],
      destacado: true,
    },
  ],
};

export const testimonios = [
  {
    texto: 'Tanto la sesión previa a los 15 de mi hermana y durante la fiesta, ¡excelente atención! Quedamos súper conformes.',
    nombre: 'Micaela',
    detalle: '15 años · Rosario',
  },
  {
    texto: 'Las fotos hermosas. Fue un gusto contar con vos en estos momentos inolvidables para mi niña. Muy agradecida por tu trabajo.',
    nombre: 'Silvia',
    detalle: '15 años · Rosario',
  },
  {
    texto: 'Divinas las fotos, me encantaron. Se pasaron, ¡son los mejores! ¡Gracias!',
    nombre: 'Abigail',
    detalle: '15 años · Rosario',
  },
];

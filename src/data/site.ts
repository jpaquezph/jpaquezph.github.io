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

// Datos extra por categoría, según el nombre de la carpeta (en slug).
// `portadas` son referencias "album:numero-de-foto"; la primera es la principal.
// `coverflow` (opcional) son las fotos del carrusel de categorías de la portada, una
// por vuelta: archivos propios en public/ (versión grande y chica) o referencias
// "album:numero-de-foto".
// `nombre` reemplaza al de la carpeta; hace falta en las categorías sin carpeta de fotos.
type FotoPropia = { src: string; thumb: string; w: number; h: number; color: string };
const propia = (archivo: string, color: string, w = 1500, h = 1000): FotoPropia => ({
  src: `${archivo}.webp`,
  thumb: `${archivo}-m.webp`,
  w,
  h,
  color,
});
export const categoriasMeta: Record<
  string,
  {
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
> = {
  infantiles: {
    nombre: 'Infantiles',
    icono: 'corazon',
    texto: 'Eventos y sesiones de chicos.',
    portadas: [],
    coverflow: [propia('coverflow-infantiles', 'rgb(120 120 56)'), propia('coverflow-infantiles-02', 'rgb(72 72 72)')],
    tarjeta: propia('tarjeta-infantiles', 'rgb(72 72 8)', 1200, 1600),
    pase: propia('pase-infantiles', 'rgb(72 72 56)', 1180, 320),
  },
  sesiones: {
    icono: 'retrato',
    texto: 'Sesiones de retrato en exteriores.',
    portadas: ['abi-sesion-exterior:6', 'abi-sesion-exterior:3'],
    coverflow: [propia('coverflow-sesiones', 'rgb(24 40 24)'), propia('coverflow-sesiones-02', 'rgb(136 88 56)')],
    tarjeta: propia('tarjeta-sesiones', 'rgb(8 8 8)', 1200, 1600),
    pase: propia('pase-sesiones', 'rgb(216 216 216)', 1180, 320),
  },
  eventos: {
    icono: 'copa',
    texto: 'Cobertura de eventos.',
    portadas: ['sagrado-corazon:10', 'sagrado-corazon:3'],
    coverflow: [propia('coverflow-eventos', 'rgb(8 8 8)'), propia('coverflow-eventos-02', 'rgb(216 168 136)')],
    tarjeta: propia('tarjeta-eventos', 'rgb(8 8 8)', 1200, 1600),
    pase: propia('pase-eventos', 'rgb(8 8 8)', 1180, 320),
  },
  recitales: {
    nombre: 'Música',
    icono: 'musica',
    texto: 'Música en vivo, bandas y festivales.',
    portadas: ['destino-casual-teatro-vorterix:4', 'ateneo-cultural:12'],
    coverflow: [propia('coverflow-musica', 'rgb(40 8 40)'), propia('coverflow-musica-02', 'rgb(8 8 8)')],
    tarjeta: propia('tarjeta-musica', 'rgb(40 8 40)', 1200, 1600),
    pase: propia('pase-musica', 'rgb(56 40 24)', 1180, 320),
    banners: {
      'ateneo-cultural': [
        propia('pase-musica-02', 'rgb(24 8 40)', 1180, 320),
        propia('pase-musica-08', 'rgb(24 8 24)', 1180, 320),
      ],
      'destino-casual-teatro-vorterix': [
        propia('pase-musica-03', 'rgb(8 8 8)', 1180, 320),
        propia('pase-musica-04', 'rgb(8 8 200)', 1180, 320),
        propia('pase-musica-05', 'rgb(24 8 8)', 1180, 320),
      ],
      'ensayo-fralumalu': [propia('pase-musica-09', 'rgb(24 40 56)', 1180, 320)],
    },
    paseSueltas: [propia('pase-musica-06', 'rgb(40 24 24)', 1180, 320), propia('pase-musica-07', 'rgb(8 8 24)', 1180, 320)],
  },
  productos: {
    nombre: 'Productos',
    icono: 'caja',
    texto: 'Fotografía de productos y catálogos.',
    portadas: [],
    coverflow: [propia('coverflow-productos', 'rgb(104 104 104)'), propia('coverflow-productos-02', 'rgb(120 120 120)')],
    tarjeta: propia('tarjeta-productos', 'rgb(168 168 168)', 1200, 1600),
    banners: {
      bijouterie: [propia('pase-productos-01', 'rgb(216 216 216)', 1180, 320)],
    },
  },
};

// Nombre y bajada con que se muestra cada proyecto, por "categoria/carpeta" (en slug).
// Los que no figuran acá se muestran con el nombre de su carpeta.
export const albumesMeta: Record<string, { titulo: string; descripcion: string }> = {
  'recitales/destino-casual-teatro-vorterix': { titulo: 'Destino Casual', descripcion: 'Teatro Vorterix.' },
  'recitales/ateneo-cultural': { titulo: 'Festival Amiguero', descripcion: 'Ateneo Cultural Néstor Kirchner.' },
  'eventos/sagrado-corazon': { titulo: 'Graduación Sagrado Corazón', descripcion: 'Salón Metropolitano.' },
  'eventos/streetcar-meet-3ra-edicion': {
    titulo: 'StreetCar Meet 3ra edición',
    descripcion: 'Obras Sanitarias, Granadero Baigorria.',
  },
  'infantiles/sesion-facu': {
    titulo: 'Sesión pre bautismo Facu',
    descripcion: 'Parque Independencia, Rosario.',
  },
  'productos/bijouterie': { titulo: 'Bijouterie', descripcion: '' },
  'sesiones/hermanos-solis': { titulo: 'Hermanos Solís', descripcion: 'Rosedal del Parque Independencia, Rosario.' },
  'sesiones/abi-sesion-exterior': {
    titulo: 'Abi · 15 años',
    descripcion: 'Parque Villarino, Zavalla, y La Florida, Rosario.',
  },
};

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

export const portada = {
  // Banner principal: archivo propio en public/ (versión grande y chica).
  hero: { src: 'banner-principal.webp', thumb: 'banner-principal-m.webp', w: 2400, h: 1350 },
  // En celular la portada se recorta en vertical: qué punto de la foto queda a la
  // vista (horizontal vertical). 50% es el centro; más alto, más a la derecha.
  heroFocoCelular: '80% 22%',
  // Foto propia (no sale de las carpetas de proyectos): public/sobre-mi.webp y
  // su versión chica public/sobre-mi-m.webp.
  sobreMi: { src: 'sobre-mi.webp', thumb: 'sobre-mi-m.webp', w: 1200, h: 1600 },
};

export const destacado = {
  categoria: 'eventos',
  album: 'streetcar-meet-3ra-edicion',
  titulo: 'StreetCar Meet 3ra edición',
  texto: 'Encuentro de autos en Obras Sanitarias, Granadero Baigorria.',
  fotos: [8, 44, 34, 10, 53, 14],
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
  nota: 'Cada trabajo se cotiza a medida según fecha, lugar y duración.',
  mensajeWhatsapp: 'Hola Jorge, quiero pedir una cotización.',
  // Los precios no se muestran en el sitio: solo proponen el total al cargar un evento en el panel admin.
  planes: [
    {
      nombre: 'Sesión de exterior',
      precio: 65000,
      texto: 'Retratos, 15 años, embarazo o familia.',
      incluye: ['Rosario y alrededores', 'Entrega digital', 'Sesiones desde 1 hora'],
      destacado: false,
    },
    {
      nombre: 'Productos',
      precio: 180000,
      texto: 'Fotografía de productos y catálogos.',
      incluye: ['Estudio o en locación', 'Presupuesto por productos', 'Entrega digital'],
      destacado: false,
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

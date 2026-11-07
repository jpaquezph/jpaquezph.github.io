// Resumen en PDF de todo lo cargado de un cliente, para el panel de administración.
// Se arma en el navegador; la librería se carga recién al pedir el primer resumen.

import { condicionesGenerales, sitio } from '../data/site';
import type { FilaEvento } from './admin';
import { leerLineup } from './portal';
import { url } from './rutas';

export interface ArchivosResumen {
  contrato: boolean;
  banner: boolean;
  destacadas: number;
}

const OSCURO = '#06080c';
const ACENTO = '#ff7a3d';
const SUAVE = '#6b7080';
const TEXTO = '#1a1d24';

const MARGEN = 18;
const ANCHO_ETIQUETA = 46;

// Las fuentes estándar del PDF no traen algunos signos; se cambian por equivalentes.
const limpio = (texto: string) => texto.replace(/[  ]/g, ' ').replace(/[−–—]/g, '-');

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const dinero = (n: number) => limpio(pesos.format(n));
const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString('es-AR');

/** El logo es un SVG blanco: se pasa a PNG para poder ponerlo sobre la franja oscura. */
async function logoPng(): Promise<string | null> {
  try {
    const imagen = new Image();
    imagen.src = url('logo.svg');
    await imagen.decode();
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 256;
    lienzo.getContext('2d')!.drawImage(imagen, 0, 0, 256, 256);
    return lienzo.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function descargarResumen(e: FilaEvento, archivos: ArchivosResumen) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), logoPng()]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const anchoUtil = anchoPagina - MARGEN * 2;
  const limite = altoPagina - 20;
  let y = 0;

  const fuente = (tam: number, estilo: 'normal' | 'bold' = 'normal', color = TEXTO) => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tam);
    doc.setTextColor(color);
  };
  const lineasDe = (texto: string, ancho: number) => doc.splitTextToSize(limpio(texto), ancho) as string[];
  const alto = (lineas: string[]) => lineas.length * doc.getLineHeight() * 0.3528; // pt → mm

  const asegurar = (necesario: number) => {
    if (y + necesario <= limite) return;
    doc.addPage();
    y = MARGEN;
  };

  // --- Encabezado ---
  doc.setFillColor(OSCURO);
  doc.rect(0, 0, anchoPagina, 34, 'F');
  if (logo) doc.addImage(logo, 'PNG', MARGEN, 8, 18, 18);
  const xMarca = logo ? MARGEN + 24 : MARGEN;
  fuente(15, 'bold', '#ffffff');
  doc.text(limpio(sitio.nombreCompleto), xMarca, 16);
  fuente(9, 'normal', '#a9adba');
  doc.text(limpio(sitio.bajada), xMarca, 22);
  doc.setTextColor(ACENTO);
  doc.text('RESUMEN DEL CLIENTE', anchoPagina - MARGEN, 16, { align: 'right' });
  doc.setTextColor('#a9adba');
  doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, anchoPagina - MARGEN, 22, { align: 'right' });

  y = 48;
  fuente(20, 'bold');
  const titulo = lineasDe(e.cliente, anchoUtil);
  doc.text(titulo, MARGEN, y);
  y += alto(titulo);
  fuente(12, 'normal', SUAVE);
  const subtitulo = lineasDe(e.titulo, anchoUtil);
  doc.text(subtitulo, MARGEN, y);
  y += alto(subtitulo) + 4;

  // --- Bloques ---
  const seccion = (nombre: string) => {
    asegurar(20);
    y += 4;
    fuente(10, 'bold', ACENTO);
    doc.text(nombre.toUpperCase(), MARGEN, y);
    y += 2;
    doc.setDrawColor('#e3e5ea');
    doc.setLineWidth(0.3);
    doc.line(MARGEN, y, anchoPagina - MARGEN, y);
    y += 6;
  };

  const dato = (etiqueta: string, valor: string | null | undefined) => {
    fuente(10);
    const lineas = lineasDe(valor?.trim() || '-', anchoUtil - ANCHO_ETIQUETA);
    asegurar(alto(lineas) + 2);
    fuente(10, 'normal', SUAVE);
    doc.text(limpio(etiqueta), MARGEN, y);
    fuente(10, 'normal', valor?.trim() ? TEXTO : SUAVE);
    doc.text(lineas, MARGEN + ANCHO_ETIQUETA, y);
    y += alto(lineas) + 2;
  };

  const lista = (items: string[]) => {
    fuente(10);
    for (const item of items) {
      const lineas = lineasDe(item, anchoUtil - 6);
      asegurar(alto(lineas) + 1.5);
      doc.text('•', MARGEN + 1, y);
      doc.text(lineas, MARGEN + 6, y);
      y += alto(lineas) + 1.5;
    }
  };

  const nota = (texto: string) => {
    fuente(10, 'normal', SUAVE);
    const lineas = lineasDe(texto, anchoUtil);
    asegurar(alto(lineas) + 2);
    doc.text(lineas, MARGEN, y);
    y += alto(lineas) + 2;
  };

  seccion('Evento');
  dato('Usuario', e.usuario);
  dato('Fecha', e.fecha ? fechaLarga(e.fecha) : '');
  dato('Horario acordado', e.horario);
  dato('Lugar', e.lugar);
  dato('Dirección', e.direccion);
  dato('Servicio contratado', e.paquete);
  dato('Estado', e.estado);

  seccion('Line-up');
  const lineup = leerLineup(e.cronograma);
  if (lineup.estado === 'a-confirmar') nota('A confirmar (el cliente lo ve así).');
  else if (lineup.estado === 'no-se-detalla') nota('No se detalla (el cliente no ve esta sección).');
  if (lineup.items.length) {
    if (lineup.estado !== 'detallado') nota('Guardado para más adelante:');
    for (const item of lineup.items) {
      fuente(10);
      const titulo = lineasDe(item.titulo, anchoUtil - 22);
      const detalle = item.detalle ? (fuente(9), lineasDe(item.detalle, anchoUtil - 22)) : [];
      asegurar(alto(titulo) + alto(detalle) + 2.5);
      fuente(10, 'bold');
      doc.text(limpio(item.hora || '-'), MARGEN, y);
      fuente(10);
      doc.text(titulo, MARGEN + 22, y);
      y += alto(titulo);
      if (detalle.length) {
        fuente(9, 'normal', SUAVE);
        doc.text(detalle, MARGEN + 22, y);
        y += alto(detalle);
      }
      y += 2.5;
    }
  } else if (lineup.estado === 'detallado') {
    nota('Sin cargar.');
  }

  seccion('Precio y pagos');
  const pagado = e.pagos.reduce((suma, p) => suma + p.monto, 0);
  const saldo = Number(e.precio_total ?? 0) - pagado;
  dato('Precio total', dinero(Number(e.precio_total ?? 0)));
  if (e.pagos.length) {
    for (const p of e.pagos) dato(p.concepto, `${dinero(p.monto)}  ·  ${fechaCorta(p.fecha)}`);
  } else {
    dato('Pagos recibidos', '');
  }
  dato('Total pagado', dinero(pagado));
  fuente(10, 'bold');
  asegurar(8);
  doc.text('Saldo', MARGEN, y);
  doc.setTextColor(saldo > 0 ? ACENTO : TEXTO);
  doc.text(dinero(saldo), MARGEN + ANCHO_ETIQUETA, y);
  y += alto(['x']) + 2;
  dato('Vencimiento del saldo', e.vencimiento_saldo ? fechaLarga(e.vencimiento_saldo) : '');
  y += 2;
  fuente(10, 'bold');
  asegurar(10);
  doc.text('Qué incluye', MARGEN, y);
  y += 5.5;
  if (e.incluye.length) lista(e.incluye);
  else nota('Sin cargar.');

  seccion('Entrega de fotos');
  dato('Carpeta de Drive', e.drive_url);
  dato('Texto de entrega', e.entrega);

  seccion('Contrato y archivos');
  dato('Firma del contrato', e.contrato_firmado ? fechaLarga(e.contrato_firmado) : '');
  dato('Copia del contrato', archivos.contrato ? 'PDF cargado' : 'Sin cargar');
  dato('Banner del encabezado', archivos.banner ? 'Cargado' : 'Sin cargar');
  dato('Fotos destacadas', archivos.destacadas ? `${archivos.destacadas} cargadas` : 'Ninguna');

  seccion('Condiciones de contratación');
  if (!e.condiciones.length) nota('Sin condiciones propias: el cliente ve las generales del sitio.');
  lista(e.condiciones.length ? e.condiciones : condicionesGenerales);

  // --- Pie en todas las páginas ---
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    fuente(8, 'normal', SUAVE);
    doc.text(limpio(`${sitio.nombreCompleto} · ${sitio.email} · ${sitio.ciudad}`), MARGEN, altoPagina - 10);
    doc.text(`Página ${i} de ${paginas}`, anchoPagina - MARGEN, altoPagina - 10, { align: 'right' });
  }

  const nombre = (e.usuario || e.cliente).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`resumen-${nombre || 'cliente'}-${e.fecha}.pdf`);
}

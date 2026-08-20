import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { puedeRegularizarMasivo } from '@/lib/reglas';
import { insertRespaldo, regularizarMasivoParaJefatura } from '@/lib/casos';

export const runtime = 'nodejs';

// Mismo tope que el adjunto por caso: Vercel corta el cuerpo de una función
// serverless en ~4.5 MB a nivel de plataforma, antes de que este código
// llegue a ejecutarse.
const MAX_BYTES = 4 * 1024 * 1024;
const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'doc', 'docx'];

function extensionDe(nombre: string): string {
  return (nombre.split('.').pop() || '').toLowerCase();
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'jefatura' || !puedeRegularizarMasivo(session.nombre)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });

  const fechaDesde = String(form.get('fechaDesde') || '');
  const fechaHasta = String(form.get('fechaHasta') || fechaDesde);
  const motivo = String(form.get('motivo') || '').trim();
  const horaEntrada = String(form.get('horaEntrada') || '');
  const horaSalida = String(form.get('horaSalida') || '');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta)) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  }
  if (fechaHasta < fechaDesde) {
    return NextResponse.json({ error: 'El rango de fechas no es válido' }, { status: 400 });
  }
  if (!motivo) return NextResponse.json({ error: 'Falta el motivo' }, { status: 400 });

  let contenido: Buffer | null = null;
  let archivoNombre = '';
  let archivoTipo = '';
  const archivo = form.get('archivo');
  if (archivo && typeof archivo !== 'string') {
    if (archivo.size > MAX_BYTES) {
      return NextResponse.json({ error: 'El archivo supera el tamaño máximo permitido (4 MB). Comprima el PDF o la imagen e intente de nuevo.' }, { status: 400 });
    }
    const ext = extensionDe(archivo.name);
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Use PDF, imagen (jpg/png/heic) o Word (doc/docx).' }, { status: 400 });
    }
    contenido = Buffer.from(await archivo.arrayBuffer());
    archivoNombre = archivo.name;
    archivoTipo = archivo.type || '';
  }

  const { afectados } = await regularizarMasivoParaJefatura(session, fechaDesde, fechaHasta, motivo, horaEntrada, horaSalida);

  if (contenido) {
    for (const id of afectados) {
      await insertRespaldo(id, archivoNombre, archivoTipo, contenido, session.nombre);
    }
  }

  return NextResponse.json({ afectados: afectados.length });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { reemplazarDotacion } from '@/lib/casos';
import { parseCsvDotacion, parseXlsxDotacion } from '@/lib/parseUpload';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('archivo');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo supera el tamaño máximo permitido (25 MB).' }, { status: 400 });
  }

  try {
    const registros = /\.csv$/i.test(file.name) ? parseCsvDotacion(await file.text()) : await parseXlsxDotacion(await file.arrayBuffer());
    if (!registros.length) {
      return NextResponse.json({ error: 'El archivo no contiene filas con RUT y nombre reconocibles.' }, { status: 400 });
    }
    const stats = await reemplazarDotacion(registros);
    return NextResponse.json({
      ok: true,
      mensajeCarga:
        'Dotación actualizada: ' +
        stats.funcionarios +
        ' funcionarios, ' +
        stats.jefaturas +
        ' jefaturas. ' +
        stats.casosRecalculados +
        ' inconsistencias ya cargadas cambiaron de jefatura o unidad tras el cruce.',
      ...stats,
    });
  } catch (e) {
    return NextResponse.json({ error: 'No se pudo leer el archivo: ' + (e instanceof Error ? e.message : String(e)) }, { status: 400 });
  }
}

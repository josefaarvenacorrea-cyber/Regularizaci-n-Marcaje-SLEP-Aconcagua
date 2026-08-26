import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { regularizarAsistenciaPersona } from '@/lib/casos';
import { parseCsvAsistencia, parseXlsxAsistencia } from '@/lib/parseUpload';
import { normRut } from '@/lib/reglas';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const rut = normRut(String(form?.get('rut') ?? ''));
  if (!rut) return NextResponse.json({ error: 'Ingrese el RUT de la persona.' }, { status: 400 });

  const file = form?.get('archivo');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo supera el tamaño máximo permitido (25 MB).' }, { status: 400 });
  }

  try {
    let registros;
    if (/\.csv$/i.test(file.name)) {
      registros = parseCsvAsistencia(await file.text());
    } else {
      registros = await parseXlsxAsistencia(await file.arrayBuffer());
    }
    if (!registros.length) {
      return NextResponse.json({ error: 'El archivo no contiene filas con fecha.' }, { status: 400 });
    }
    const resultado = await regularizarAsistenciaPersona(rut, registros);
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json({ error: 'No se pudo leer el archivo: ' + (e instanceof Error ? e.message : String(e)) }, { status: 400 });
  }
}

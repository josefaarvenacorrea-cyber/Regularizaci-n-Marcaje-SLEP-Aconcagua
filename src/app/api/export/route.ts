import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { allCasos, getConfig, misCasos } from '@/lib/casos';
import { execute } from '@/lib/db';
import { nombreArchivo } from '@/lib/reglas';
import { construirLibro } from '@/lib/exportXlsx';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.rol === 'funcionario') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const consolidado = request.nextUrl.searchParams.get('scope') === 'consolidado';
  const huerfanos = request.nextUrl.searchParams.get('huerfanos') === '1';
  if (consolidado && session.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const fuente = consolidado ? await allCasos() : await misCasos(session, { verHuerfanos: session.rol === 'admin' && huerfanos });
  const listos = fuente.filter((c) => c.confirmada);
  if (!listos.length) {
    return NextResponse.json({ error: 'No hay inconsistencias regularizadas para exportar.' }, { status: 400 });
  }

  const alcance = consolidado
    ? 'consolidado_servicio'
    : session.rol === 'admin'
      ? huerfanos
        ? 'casos sin jefatura'
        : 'gestion_de_personas'
      : session.nombre;

  const config = await getConfig();
  const periodo = config.periodo || '';
  const archivo = nombreArchivo(periodo, alcance);
  const buf = await construirLibro(listos);

  await execute('INSERT INTO archivos_generados (archivo, jefatura, filas, fecha, alcance, contenido) VALUES ($1,$2,$3,$4,$5,$6)', [
    archivo,
    consolidado ? 'Todo el servicio' : session.nombre,
    listos.length,
    new Date().toLocaleString('es-CL'),
    alcance,
    buf,
  ]);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${archivo}"`,
    },
  });
}

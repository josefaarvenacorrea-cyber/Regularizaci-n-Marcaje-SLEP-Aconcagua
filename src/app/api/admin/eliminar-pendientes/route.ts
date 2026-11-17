import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { eliminarPendientesPorRangoFecha } from '@/lib/casos';

// Elimina de una vez los casos pendientes (sin regularizar) de un rango de
// fechas — para deshacer una carga completa. Nunca toca un caso que la
// jefatura ya haya regularizado y confirmado.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const fechaDesde = typeof body.fechaDesde === 'string' ? body.fechaDesde : '';
  const fechaHasta = typeof body.fechaHasta === 'string' ? body.fechaHasta : '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta)) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
  }
  if (fechaDesde > fechaHasta) {
    return NextResponse.json({ error: 'La fecha desde no puede ser posterior a la fecha hasta' }, { status: 400 });
  }

  const resultado = await eliminarPendientesPorRangoFecha(fechaDesde, fechaHasta);
  return NextResponse.json(resultado);
}

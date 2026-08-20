import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { regularizarMasivoPorFecha } from '@/lib/casos';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const fecha = typeof body.fecha === 'string' ? body.fecha : '';
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : '';
  const horaEntrada = typeof body.horaEntrada === 'string' ? body.horaEntrada : '';
  const horaSalida = typeof body.horaSalida === 'string' ? body.horaSalida : '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  if (!motivo) return NextResponse.json({ error: 'Falta el motivo' }, { status: 400 });

  const resultado = await regularizarMasivoPorFecha(fecha, motivo, horaEntrada, horaSalida);
  return NextResponse.json(resultado);
}

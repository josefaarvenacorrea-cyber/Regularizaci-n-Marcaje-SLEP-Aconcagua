import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { regularizarMarcajeExitoso } from '@/lib/casos';
import { normRut } from '@/lib/reglas';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const rut = normRut(typeof body.rut === 'string' ? body.rut : '');
  const fecha = typeof body.fecha === 'string' ? body.fecha : '';
  const horaEntrada = typeof body.horaEntrada === 'string' ? body.horaEntrada : '';
  const horaSalida = typeof body.horaSalida === 'string' ? body.horaSalida : '';

  if (!rut) return NextResponse.json({ error: 'Ingrese el RUT de la persona.' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 });
  if (!horaEntrada && !horaSalida) return NextResponse.json({ error: 'Ingrese al menos una hora.' }, { status: 400 });

  const resultado = await regularizarMarcajeExitoso(rut, fecha, horaEntrada, horaSalida);
  return NextResponse.json(resultado);
}

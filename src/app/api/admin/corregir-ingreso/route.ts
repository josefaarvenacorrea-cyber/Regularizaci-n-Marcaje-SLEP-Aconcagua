import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { corregirIngresoFuncionario } from '@/lib/casos';
import { normRut } from '@/lib/reglas';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const rut = normRut(typeof body.rut === 'string' ? body.rut : '');
  const fechaIngreso = typeof body.fechaIngreso === 'string' ? body.fechaIngreso : '';

  if (!rut) return NextResponse.json({ error: 'Ingrese el RUT de la persona.' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) return NextResponse.json({ error: 'Fecha de ingreso inválida.' }, { status: 400 });

  const resultado = await corregirIngresoFuncionario(rut, fechaIngreso);
  return NextResponse.json(resultado);
}

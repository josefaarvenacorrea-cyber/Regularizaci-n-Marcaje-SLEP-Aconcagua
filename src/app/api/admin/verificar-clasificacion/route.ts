import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { verificarClasificacionExistente } from '@/lib/casos';

// Verificación de una vez: corre las tres correcciones de clasificación
// (Atraso, Falta, Salida Anticipada) sobre los casos pendientes ya
// cargados, en un solo paso.
export async function POST() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const resultado = await verificarClasificacionExistente();
  return NextResponse.json(resultado);
}

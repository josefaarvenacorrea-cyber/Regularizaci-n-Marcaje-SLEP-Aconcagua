import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { corregirClasificacionAtrasoExistente } from '@/lib/casos';

// Corrección de una vez: casos "Atraso" ya cargados cuya entrada en
// realidad cae dentro del margen de tolerancia del turno. Las cargas
// futuras ya se corrigen solas en actualizarBase — esto es solo para
// arreglar lo que ya estaba mal clasificado antes de ese cambio.
export async function POST() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const resultado = await corregirClasificacionAtrasoExistente();
  return NextResponse.json(resultado);
}

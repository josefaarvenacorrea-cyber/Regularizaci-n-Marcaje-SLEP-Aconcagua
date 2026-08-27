import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { corregirClasificacionFaltaExistente } from '@/lib/casos';

// Corrección de una vez: casos "Falta Entrada"/"Falta Salida" ya cargados
// que en realidad no tienen ninguna marca ese día (deberían ser
// "Inasistencia Injustificada"). Las cargas futuras ya se corrigen solas en
// actualizarBase — esto es solo para arreglar lo que ya estaba mal
// clasificado antes de ese cambio.
export async function POST() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const resultado = await corregirClasificacionFaltaExistente();
  return NextResponse.json(resultado);
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { corregirClasificacionSalidaAnticipadaExistente } from '@/lib/casos';

// Corrección de una vez: casos "Salida Anticipada" ya cargados cuya salida
// en realidad sí alcanza a cubrir la jornada del día (9 horas de lunes a
// jueves, 8 el viernes). Las cargas futuras ya se corrigen solas en
// actualizarBase — esto es solo para arreglar lo que ya estaba mal
// clasificado antes de ese cambio.
export async function POST() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const resultado = await corregirClasificacionSalidaAnticipadaExistente();
  return NextResponse.json(resultado);
}

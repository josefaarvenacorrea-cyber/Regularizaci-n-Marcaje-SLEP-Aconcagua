import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { casosPropios } from '@/lib/casos';

// Solo para jefaturas: sus propias inconsistencias de marcaje, de solo
// lectura (las regulariza su propia jefatura, no ella misma).
export async function GET() {
  const session = await getSession();
  if (!session || session.rol !== 'jefatura') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  return NextResponse.json({ casos: await casosPropios(session) });
}

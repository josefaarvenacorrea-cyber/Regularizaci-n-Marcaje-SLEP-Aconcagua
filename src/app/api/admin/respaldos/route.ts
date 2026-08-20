import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { respaldosPorPersonaYCaso } from '@/lib/casos';

export async function GET() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  return NextResponse.json({ personas: await respaldosPorPersonaYCaso() });
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const registro = await query('SELECT id, archivo, jefatura, filas, fecha FROM archivos_generados ORDER BY id DESC LIMIT 40');
  return NextResponse.json({ registro });
}

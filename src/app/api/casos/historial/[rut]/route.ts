import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { misCasos } from '@/lib/casos';

export async function GET(_request: Request, ctx: { params: Promise<{ rut: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { rut } = await ctx.params;
  const equipo = await misCasos(session, {});
  const items = equipo.filter((c) => c.rut === decodeURIComponent(rut));
  return NextResponse.json({ items });
}

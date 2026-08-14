import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { misCasos } from '@/lib/casos';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const verHuerfanos = request.nextUrl.searchParams.get('huerfanos') === '1' && session.rol === 'admin';
  const casos = await misCasos(session, { verHuerfanos });
  return NextResponse.json({ casos });
}

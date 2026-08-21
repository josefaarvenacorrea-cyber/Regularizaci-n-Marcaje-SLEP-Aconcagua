import { NextRequest, NextResponse } from 'next/server';
import { cambiarClavePropia, getSession, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const claveNueva = typeof body.claveNueva === 'string' ? body.claveNueva : '';

  const result = await cambiarClavePropia(session, claveNueva);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await setSessionCookie(result.session);
  return NextResponse.json({ session: result.session });
}

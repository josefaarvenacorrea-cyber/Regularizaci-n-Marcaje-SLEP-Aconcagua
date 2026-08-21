import { NextRequest, NextResponse } from 'next/server';
import { resolveLogin, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const correo = typeof body.correo === 'string' ? body.correo : '';
  const clave = typeof body.clave === 'string' ? body.clave : '';
  const result = await resolveLogin(correo, clave);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  await setSessionCookie(result.session);
  return NextResponse.json({ session: result.session });
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getConfig } from '@/lib/casos';
import { puedeRegularizarMasivo } from '@/lib/reglas';

export async function GET() {
  const session = await getSession();
  const config = await getConfig();
  const puedeMasivo = !!session && session.rol === 'jefatura' && puedeRegularizarMasivo(session.nombre);
  return NextResponse.json({ session, config, puedeMasivo });
}

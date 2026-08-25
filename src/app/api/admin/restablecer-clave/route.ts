import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { borrarClaveCustom, limpiarIntentosLogin, loadDotacion } from '@/lib/casos';
import { key } from '@/lib/reglas';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const correo = key(typeof body.correo === 'string' ? body.correo : '');
  if (!correo) return NextResponse.json({ error: 'Ingrese el correo de la persona.' }, { status: 400 });

  const dot = await loadDotacion();
  const ficha = dot.find((d) => key(d.correo) === correo);
  if (!ficha) return NextResponse.json({ error: 'Ese correo no está en la dotación efectiva vigente.' }, { status: 400 });

  await borrarClaveCustom(correo);
  await limpiarIntentosLogin(correo);

  return NextResponse.json({ ok: true, nombre: ficha.nombre });
}

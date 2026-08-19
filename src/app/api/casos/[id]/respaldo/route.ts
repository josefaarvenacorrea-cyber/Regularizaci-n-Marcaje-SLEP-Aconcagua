import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { casoVisiblePara, getCasoById, insertRespaldo, listRespaldos } from '@/lib/casos';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ARCHIVOS_POR_CASO = 6;
const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'doc', 'docx'];

function extensionDe(nombre: string): string {
  return (nombre.split('.').pop() || '').toLowerCase();
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await casoVisiblePara(session, id))) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
  }
  return NextResponse.json({ archivos: await listRespaldos(id) });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.rol === 'funcionario') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await ctx.params;
  if (!(await casoVisiblePara(session, id))) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
  }
  const row = await getCasoById(id);
  if (!row) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
  // Igual que editar campos: un caso ya enviado no se toca sin deshacerlo
  // primero, para que el correo que ya salió no quede desactualizado.
  if (row.confirmada) {
    return NextResponse.json({ error: 'Este caso ya fue enviado. Use «Deshacer» para adjuntar archivos.' }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('archivo');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el tamaño máximo permitido (8 MB).' }, { status: 400 });
  }
  const ext = extensionDe(file.name);
  if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
    return NextResponse.json(
      { error: 'Tipo de archivo no permitido. Use PDF, imagen (jpg/png/heic) o Word (doc/docx).' },
      { status: 400 }
    );
  }
  const existentes = await listRespaldos(id);
  if (existentes.length >= MAX_ARCHIVOS_POR_CASO) {
    return NextResponse.json({ error: 'Este caso ya tiene el máximo de ' + MAX_ARCHIVOS_POR_CASO + ' archivos adjuntos.' }, { status: 400 });
  }

  const contenido = Buffer.from(await file.arrayBuffer());
  const meta = await insertRespaldo(id, file.name, file.type || '', contenido, session.nombre);
  return NextResponse.json({ archivo: meta, archivos: await listRespaldos(id) });
}

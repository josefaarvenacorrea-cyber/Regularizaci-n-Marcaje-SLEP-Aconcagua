import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { casoVisiblePara, deleteRespaldo, getCasoById, getRespaldoContenido, listRespaldos } from '@/lib/casos';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string; respaldoId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id, respaldoId } = await ctx.params;
  if (!(await casoVisiblePara(session, id))) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
  const archivo = await getRespaldoContenido(parseInt(respaldoId, 10));
  if (!archivo || archivo.casoId !== id) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(archivo.contenido), {
    headers: {
      'Content-Type': archivo.mimetype || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${archivo.nombreArchivo.replace(/"/g, '')}"`,
    },
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; respaldoId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.rol === 'funcionario') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id, respaldoId } = await ctx.params;
  if (!(await casoVisiblePara(session, id))) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
  const row = await getCasoById(id);
  if (!row) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
  if (row.confirmada) {
    return NextResponse.json({ error: 'Este caso ya fue enviado. Use «Deshacer» para quitar archivos.' }, { status: 400 });
  }
  const archivo = await getRespaldoContenido(parseInt(respaldoId, 10));
  if (!archivo || archivo.casoId !== id) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }
  await deleteRespaldo(parseInt(respaldoId, 10));
  return NextResponse.json({ archivos: await listRespaldos(id) });
}

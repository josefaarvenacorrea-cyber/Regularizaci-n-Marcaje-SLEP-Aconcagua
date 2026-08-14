import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await ctx.params;

  const row = await queryOne<{ archivo: string; contenido: Buffer | null }>(
    'SELECT archivo, contenido FROM archivos_generados WHERE id = $1',
    [id]
  );
  if (!row || !row.contenido) {
    return NextResponse.json({ error: 'El archivo ya no está disponible para descargar.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(row.contenido), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${row.archivo}"`,
    },
  });
}

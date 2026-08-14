import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { execute } from '@/lib/db';
import { casoVisiblePara, getCasoById, getCasoFormatted } from '@/lib/casos';
import { motivosDe } from '@/lib/reglas';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await ctx.params;

  if (!(await casoVisiblePara(session, id))) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
  }
  const row = await getCasoById(id);
  if (!row) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.limpiar) {
    await execute(`UPDATE inconsistencias SET motivo='', entrada_real='', salida_real='', obs='', updated_at=$1 WHERE id=$2`, [now, id]);
  } else if (body.toggleRespaldo) {
    const nuevo = row.respaldo ? '' : 'respaldo-' + row.rut.replace(/\./g, '') + '.pdf';
    await execute(`UPDATE inconsistencias SET respaldo=$1, updated_at=$2 WHERE id=$3`, [nuevo, now, id]);
  } else {
    const updates: Record<string, string> = {};
    if (typeof body.motivo === 'string') {
      const validos = motivosDe(row.tipo).map((m) => m.v);
      if (body.motivo !== '' && !validos.includes(body.motivo)) {
        return NextResponse.json({ error: 'Motivo no permitido para este tipo de inconsistencia' }, { status: 400 });
      }
      updates.motivo = body.motivo;
      // Igual que el prototipo: cambiar el motivo reinicia las horas capturadas.
      updates.entrada_real = '';
      updates.salida_real = '';
    }
    if (typeof body.entradaReal === 'string') updates.entrada_real = body.entradaReal;
    if (typeof body.salidaReal === 'string') updates.salida_real = body.salidaReal;
    if (typeof body.obs === 'string') updates.obs = body.obs;
    const campos = Object.keys(updates);
    if (campos.length) {
      const sets = campos.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const valores = campos.map((k) => updates[k]);
      await execute(`UPDATE inconsistencias SET ${sets}, updated_at = $${campos.length + 1} WHERE id = $${campos.length + 2}`, [
        ...valores,
        now,
        id,
      ]);
    }
  }

  const updated = await getCasoFormatted(id);
  return NextResponse.json({ caso: updated });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { execute } from '@/lib/db';
import { casoVisiblePara, getCasoById, getCasoFormatted, getConfig, getConfigBool, listRespaldos, loadDotacion } from '@/lib/casos';
import { completa as calcCompleta, key, motivosDe } from '@/lib/reglas';
import { notificarJustificacion } from '@/lib/mailer';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  // El funcionario solo tiene acceso de lectura a sus propios casos; nunca
  // puede editarlos (eso es exclusivo de su jefatura).
  if (session.rol === 'funcionario') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await ctx.params;

  if (!(await casoVisiblePara(session, id))) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
  }
  const row = await getCasoById(id);
  if (!row) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });

  const horaSoloOlvido = await getConfigBool('horaSoloOlvido', false);
  const confirmadaAntes = row.confirmada;

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.limpiar) {
    await execute(
      `UPDATE inconsistencias SET motivo='', entrada_real='', salida_real='', obs='', confirmada=false, updated_at=$1 WHERE id=$2`,
      [now, id]
    );
  } else if (body.confirmar) {
    // El botón "Enviar": recién acá se considera el caso oficialmente
    // justificado (dispara el correo y desaparece de la vista por defecto).
    // Se revalida `completa` en el servidor — el botón del cliente ya lo
    // exige, pero no hay que confiar en eso.
    const respaldos = await listRespaldos(id);
    const completaAhora = calcCompleta(
      { tipo: row.tipo, motivo: row.motivo, entradaReal: row.entrada_real, salidaReal: row.salida_real, obs: row.obs, entro: row.entro, salio: row.salio, respaldos: respaldos.length },
      horaSoloOlvido
    );
    if (!completaAhora) {
      return NextResponse.json({ error: 'Faltan datos para enviar este caso.' }, { status: 400 });
    }
    await execute(`UPDATE inconsistencias SET confirmada=true, updated_at=$1 WHERE id=$2`, [now, id]);
  } else {
    // Un caso ya enviado no se edita a medio camino: hay que deshacerlo
    // primero (lo que también avisa que la notificación ya salió).
    if (row.confirmada) {
      return NextResponse.json({ error: 'Este caso ya fue enviado. Use «Deshacer» para editarlo de nuevo.' }, { status: 400 });
    }
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

  // Solo se notifica el momento en que el caso pasa a "enviado" (confirmada),
  // no en cada edición de campos ni al quedar completo sin enviar todavía.
  if (updated && !confirmadaAntes && updated.confirmada) {
    const [dot, config] = await Promise.all([loadDotacion(), getConfig()]);
    const funcionario = dot.find((d) => d.rut === updated.rut);
    const jefe = updated.jefatura ? dot.find((d) => key(d.nombre) === key(updated.jefatura!)) : undefined;
    const adminCorreos = (config.correosAdmin || 'administracion.personas@slepaconcagua.gob.cl')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    // Hay que esperar esto, no dispararlo "en segundo plano": en Vercel la
    // función se apaga apenas se manda la respuesta, así que un fetch sin
    // await queda cortado a medio camino y el correo nunca sale — en local
    // (`next dev`) no se nota porque el proceso sigue vivo igual.
    await notificarJustificacion(updated, {
      funcionarioCorreo: funcionario?.correo,
      jefaturaCorreo: jefe?.correo,
      jefaturaNombre: updated.jefatura || session.nombre,
      adminCorreos,
    }).catch(() => {});
  }

  return NextResponse.json({ caso: updated });
}

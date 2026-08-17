import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { allCasos, loadDotacion } from '@/lib/casos';
import { key } from '@/lib/reglas';

export async function GET() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const [dot, todos] = await Promise.all([loadDotacion(), allCasos()]);

  const conteo = new Map<string, { casos: number; res: number }>();
  for (const c of todos) {
    if (!c.jefatura) continue;
    const k = key(c.jefatura);
    const e = conteo.get(k) || { casos: 0, res: 0 };
    e.casos++;
    if (c.confirmada) e.res++;
    conteo.set(k, e);
  }

  const nombresJefes = [...new Set(dot.map((d) => d.jefatura).filter((j) => j && j !== '-'))];
  const jefaturas = nombresJefes
    .map((nom) => {
      const k = key(nom);
      const ficha = dot.find((d) => key(d.nombre) === k);
      const c = conteo.get(k) || { casos: 0, res: 0 };
      return {
        nombre: nom,
        correo: ficha?.correo || '—',
        area: ficha?.area || '—',
        cargo: ficha?.cargo || 'Jefatura',
        equipo: dot.filter((d) => key(d.jefatura || '') === k).length,
        casos: c.casos,
        resueltos: c.res,
        pct: c.casos ? Math.round((c.res / c.casos) * 100) : 0,
      };
    })
    .sort((a, b) => b.casos - b.resueltos - (a.casos - a.resueltos));

  const casosSinJefatura = todos.filter((c) => c.jefatura === '').length;
  const casosNoIdentificados = todos.filter((c) => c.jefatura === null).length;

  return NextResponse.json({
    jefaturas,
    casosSinJefatura,
    casosNoIdentificados,
    casosAsignados: todos.filter((c) => c.jefatura).length,
    jefaturasPendientes: jefaturas.filter((j) => j.casos > j.resueltos).length,
    funcionariosDotacion: dot.length,
  });
}

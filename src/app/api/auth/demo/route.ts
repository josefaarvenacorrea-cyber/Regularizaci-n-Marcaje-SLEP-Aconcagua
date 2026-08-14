import { NextResponse } from 'next/server';
import { allCasos, getConfig, loadDotacion } from '@/lib/casos';
import { key } from '@/lib/reglas';

const DEMO_BASE = [
  'Yasna Anaquina Flos Jara',
  'Teresa Luisa Naranjo Reines',
  'Loredanna Penelope Rosati Aravena',
  'Alejandra De Las Mercedes Meza Veas',
];

export async function GET() {
  const [dot, todos, config] = await Promise.all([loadDotacion(), allCasos(), getConfig()]);
  const conteo = new Map<string, number>();
  for (const c of todos) {
    if (!c.jefatura) continue;
    const k = key(c.jefatura);
    conteo.set(k, (conteo.get(k) || 0) + 1);
  }
  const admin = (config.correosAdmin || 'gestiondepersonas@slepaconcagua.gob.cl').split(',')[0].trim();

  type DemoLogin = { nombre: string; correo: string; etiqueta: string; rol: 'admin' | 'jefatura' };
  const demoLogins: DemoLogin[] = [
    ...DEMO_BASE.map((nom): DemoLogin => {
      const f = dot.find((d) => key(d.nombre) === key(nom));
      return {
        nombre: nom,
        correo: f?.correo || '—',
        etiqueta: (conteo.get(key(nom)) || 0) + ' casos',
        rol: 'jefatura',
      };
    }),
    { nombre: 'Gestión de Personas (administración)', correo: admin, etiqueta: 'Admin', rol: 'admin' },
  ];

  return NextResponse.json({ demoLogins });
}

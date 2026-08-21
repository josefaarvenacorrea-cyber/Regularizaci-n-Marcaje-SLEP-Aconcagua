import { NextResponse } from 'next/server';
import { allCasos, getConfig, loadDotacion } from '@/lib/casos';
import { key, normRut } from '@/lib/reglas';

// Misma fórmula que auth.ts (primeros 4 dígitos del RUT): al panel de
// pruebas le sirve traer ya calculada la clave de cada acceso, para que un
// clic entre directo sin tener que copiarla a mano. Solo existe en
// desarrollo (ver el corte de process.env.NODE_ENV más abajo), así que esto
// nunca queda expuesto en producción.
function claveDemo(rut: string): string {
  return normRut(rut).slice(0, 4);
}

const DEMO_BASE = [
  'Yasna Anaquina Flos Jara',
  'Teresa Luisa Naranjo Reines',
  'Loredanna Penelope Rosati Aravena',
  'Alejandra De Las Mercedes Meza Veas',
];

export async function GET() {
  // Panel de accesos de prueba: solo tiene sentido para desarrollo/demo. En
  // producción, además de no ser útil para las jefaturas reales, expondría
  // sin autenticación los correos institucionales y la cantidad de casos de
  // cada jefatura a cualquiera que abra la pantalla de login.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ demoLogins: [] });
  }

  const [dot, todos, config] = await Promise.all([loadDotacion(), allCasos(), getConfig()]);
  const conteo = new Map<string, number>();
  for (const c of todos) {
    if (!c.jefatura) continue;
    const k = key(c.jefatura);
    conteo.set(k, (conteo.get(k) || 0) + 1);
  }
  const admin = (config.correosAdmin || 'administracion.personas@slepaconcagua.gob.cl').split(',')[0].trim();

  const jefaturas = new Set(dot.map((d) => key(d.jefatura || '')).filter(Boolean));
  const funcionario = dot.find((d) => d.correo && !jefaturas.has(key(d.nombre)));

  type DemoLogin = { nombre: string; correo: string; clave: string; etiqueta: string; rol: 'admin' | 'jefatura' | 'funcionario' };
  const demoLogins: DemoLogin[] = [
    ...DEMO_BASE.map((nom): DemoLogin => {
      const f = dot.find((d) => key(d.nombre) === key(nom));
      return {
        nombre: nom,
        correo: f?.correo || '—',
        clave: claveDemo(f?.rut || ''),
        etiqueta: (conteo.get(key(nom)) || 0) + ' casos',
        rol: 'jefatura',
      };
    }),
    { nombre: 'Gestión de Personas (administración)', correo: admin, clave: process.env.ADMIN_PASSWORD || '', etiqueta: 'Admin', rol: 'admin' },
    ...(funcionario
      ? [{ nombre: funcionario.nombre, correo: funcionario.correo, clave: claveDemo(funcionario.rut), etiqueta: 'Funcionario (solo lectura)', rol: 'funcionario' as const }]
      : []),
  ];

  return NextResponse.json({ demoLogins });
}

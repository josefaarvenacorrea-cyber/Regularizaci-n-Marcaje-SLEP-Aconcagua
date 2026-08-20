// Reglas de negocio de la regularización de marcajes — portadas 1:1 desde el
// prototipo `Regularización de Marcajes.dc.html` (catálogo de motivos, grupo
// por tipo de inconsistencia, qué hora pide cada caso, cuándo un caso está
// completo). Módulo compartido: lo usan tanto las rutas de API (validación
// autoritativa) como los componentes de UI (estado derivado).

export type Motivo = { v: string; hora?: boolean; obs?: boolean; requiereMarca?: boolean; oculto?: boolean };

export const CATALOGO: Record<'falta' | 'atraso' | 'inasistencia', Motivo[]> = {
  falta: [
    { v: 'Olvido Involuntario', hora: true },
    { v: 'Problemas técnicos en dispositivos de marcaje', hora: true, obs: true },
    { v: 'Salida por emergencia o fuerza mayor', hora: true, obs: true },
    { v: 'Primer día de trabajo (aún no enrolado en el reloj de marcación)', hora: true },
    // Usado solo por la regularización masiva de la puesta en marcha del
    // reloj control (un hecho único, no algo que vuelva a pasar): no se
    // ofrece en el menú de motivos, pero sigue siendo un motivo válido para
    // que esos casos ya regularizados cuenten correctamente como resueltos.
    { v: 'Pruebas por instalación de reloj de marcación', hora: true, oculto: true },
    { v: 'Autorizar el descuento' },
  ],
  atraso: [
    { v: 'Permiso' },
    { v: 'Cometido Funcionario', obs: true },
    { v: 'Horas Compensatorias' },
    // El permiso gremial no exime de marcar: si el caso no tiene una marca de
    // entrada real (columna "Entró" del reloj control), este motivo no basta.
    { v: 'Permiso Gremial', requiereMarca: true },
    { v: 'Primer día de trabajo (aún no enrolado en el reloj de marcación)', hora: true },
    { v: 'Pruebas por instalación de reloj de marcación', hora: true, oculto: true },
    { v: 'Autorizar el descuento' },
  ],
  inasistencia: [
    { v: 'Permiso' },
    { v: 'Horas Compensatorias' },
    { v: 'Olvido Involuntario', hora: true },
    { v: 'Problemas Técnicos en Dispositivos de Marcaje', hora: true, obs: true },
    { v: 'Permiso Gremial' },
    { v: 'Primer día de trabajo (aún no enrolado en el reloj de marcación)', hora: true },
    { v: 'Pruebas por instalación de reloj de marcación', hora: true, oculto: true },
    { v: 'Autorizar el descuento' },
  ],
};

export const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
export const COLUMNAS = [
  'RUT / ID funcionario', 'Nombre', 'Unidad / departamento', 'Fecha',
  'Tipo de inconsistencia', 'Hora entrada real', 'Hora salida real',
  'Motivo de justificación', 'Observación',
];

export function key(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normRut(s: string | null | undefined): string {
  return String(s || '').replace(/[.\s]/g, '').toUpperCase();
}

export function titulo(s: string | null | undefined): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase());
}

export function grupo(tipo: string): 'falta' | 'atraso' | 'inasistencia' {
  const t = key(tipo);
  if (/falta entrada|falta salida|falta marca/.test(t)) return 'falta';
  if (/atraso|adelanto|anticipada|tardia/.test(t)) return 'atraso';
  return 'inasistencia';
}

export function motivosDe(tipo: string): Motivo[] {
  return CATALOGO[grupo(tipo)];
}

// Igual que motivosDe, pero sin los motivos "ocultos" (los reservados para
// herramientas administrativas puntuales) — esta es la lista que se le debe
// mostrar a una jefatura para elegir manualmente.
export function motivosVisibles(tipo: string): Motivo[] {
  return motivosDe(tipo).filter((m) => !m.oculto);
}

// Jefaturas habilitadas para regularizar en bloque a su propio equipo (p.
// ej. cuando el equipo completo sale a una actividad grupal y se busca
// agilizar el trámite) — lista corta y puntual, no una opción general para
// cualquier jefatura. Los nombres deben coincidir exactamente con los de la
// dotación (comparados con `key()`, que ya ignora mayúsculas y tildes).
export const JEFATURAS_MASIVO = [
  'Carmen Gloria Vergara Ocampo',
  'Katherine Belinda Menares Poblete',
  'Yasna Anaquina Flos Jara',
];

export function puedeRegularizarMasivo(nombre: string): boolean {
  const k = key(nombre);
  return JEFATURAS_MASIVO.some((n) => key(n) === k);
}

export function pide(tipo: string): { e: boolean; s: boolean } {
  const t = key(tipo);
  if (/falta entrada/.test(t)) return { e: true, s: false };
  if (/falta salida/.test(t)) return { e: false, s: true };
  if (grupo(tipo) === 'atraso') return { e: true, s: false };
  return { e: true, s: true };
}

// El turno trae su propio margen de tolerancia en el texto, ej. "BH - 09:00
// hrs. (60 mins)" → no es atraso si entra antes de las 10:00. Devuelve null
// si el turno no viene en ese formato o no hay hora de entrada (no se puede
// evaluar).
function toleranciaDeTurno(turno: string): { inicioMin: number; tolMin: number } | null {
  const m = String(turno || '').match(/(\d{1,2}):(\d{2})\s*hrs.*?\((\d+)\s*mins?\)/);
  if (!m) return null;
  return { inicioMin: parseInt(m[1], 10) * 60 + parseInt(m[2], 10), tolMin: parseInt(m[3], 10) };
}

function aMinutos(hora: string | null | undefined): number | null {
  const m = String(hora || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// Reclasifica un caso "Atraso" cuya entrada en realidad cae dentro del
// margen de tolerancia del turno — no es un atraso real. Si además falta la
// marca de salida, el problema real de ese día es "Falta Salida". Si la
// salida también está marcada, ese día no tiene ninguna inconsistencia.
// Devuelve: undefined (no corresponde tocar este caso), null (no es una
// inconsistencia real, debe eliminarse) o el tipo corregido.
export function corregirTipoAtraso(tipo: string, turno: string, entro: string | null, salio: string | null): string | null | undefined {
  if (key(tipo) !== 'atraso') return undefined;
  const tol = toleranciaDeTurno(turno);
  const entroMin = aMinutos(entro);
  if (!tol || entroMin === null) return undefined;
  if (entroMin > tol.inicioMin + tol.tolMin) return undefined; // atraso real, no cambia
  return salio ? null : 'Falta Salida';
}

export type CasoEstado = {
  tipo: string;
  motivo: string;
  entradaReal: string;
  salidaReal: string;
  obs: string;
  entro?: string | null;
  salio?: string | null;
};

// Mensaje para la vista de solo lectura del funcionario: qué tiene que
// mandarle a su jefatura por con

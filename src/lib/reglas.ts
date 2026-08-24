// Reglas de negocio de la regularización de marcajes — portadas 1:1 desde el
// prototipo `Regularización de Marcajes.dc.html` (catálogo de motivos, grupo
// por tipo de inconsistencia, qué hora pide cada caso, cuándo un caso está
// completo). Módulo compartido: lo usan tanto las rutas de API (validación
// autoritativa) como los componentes de UI (estado derivado).

export type Motivo = {
  v: string;
  hora?: boolean;
  obs?: boolean;
  requiereMarca?: boolean;
  requiereRespaldo?: boolean;
  oculto?: boolean;
  // A diferencia de `oculto` (nunca aparece para nadie, reservado para
  // herramientas administrativas puntuales), este solo se oculta del menú de
  // las jefaturas — el admin sí lo ve y lo puede elegir. Para casos que solo
  // Gestión de Personas debe poder regularizar directamente.
  soloAdmin?: boolean;
};

export const CATALOGO: Record<'falta' | 'atraso' | 'inasistencia', Motivo[]> = {
  falta: [
    { v: 'Olvido Involuntario', hora: true },
    { v: 'Problemas técnicos en dispositivos de marcaje', hora: true, obs: true },
    { v: 'Salida por emergencia o fuerza mayor', hora: true, obs: true },
    { v: 'Salida a terreno', hora: true, requiereRespaldo: true },
    { v: 'Primer día de trabajo (aún no enrolado en el reloj de marcación)', hora: true },
    { v: 'Trabajó en feriado por emergencia', hora: true, soloAdmin: true },
    // Usado solo por la regularización masiva de la puesta en marcha del
    // reloj control (un hecho único, no algo que vuelva a pasar): no se
    // ofrece en el menú de motivos, pero sigue siendo un motivo válido para
    // que esos casos ya regularizados cuenten correctamente como resueltos.
    { v: 'Pruebas por instalación de reloj de marcación', hora: true, oculto: true },
    { v: 'Autorizar el descuento' },
  ],
  atraso: [
    { v: 'Permiso', requiereRespaldo: true },
    { v: 'Cometido Funcionario', obs: true, requiereRespaldo: true },
    { v: 'Horas Compensatorias', requiereRespaldo: true },
    // El permiso gremial no exime de marcar: si el caso no tiene una marca de
    // entrada real (columna "Entró" del reloj control), este motivo no basta.
    { v: 'Permiso Gremial', requiereMarca: true },
    { v: 'Problemas Técnicos en Dispositivos de Marcaje', hora: true, obs: true },
    { v: 'Olvido Involuntario', hora: true },
    { v: 'Primer día de trabajo (aún no enrolado en el reloj de marcación)', hora: true },
    { v: 'Trabajó en feriado por emergencia', hora: true, soloAdmin: true },
    { v: 'Pruebas por instalación de reloj de marcación', hora: true, oculto: true },
    { v: 'Autorizar el descuento' },
  ],
  inasistencia: [
    { v: 'Permiso', requiereRespaldo: true },
    { v: 'Horas Compensatorias', requiereRespaldo: true },
    { v: 'Olvido Involuntario', hora: true },
    { v: 'Problemas Técnicos en Dispositivos de Marcaje', hora: true, obs: true },
    { v: 'Permiso Gremial' },
    { v: 'Primer día de trabajo (aún no enrolado en el reloj de marcación)', hora: true },
    { v: 'Trabajó en feriado por emergencia', hora: true, soloAdmin: true },
    { v: 'Pruebas por instalación de reloj de marcación', hora: true, oculto: true },
    { v: 'Autorizar el descuento' },
  ]

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
export function motivosVisibles(tipo: string, esAdmin: boolean): Motivo[] {
  return motivosDe(tipo).filter((m) => !m.oculto && (esAdmin || !m.soloAdmin));
}

// A diferencia de motivosDe/completa (que necesitan saber el tipo de
// inconsistencia para ubicar el grupo correcto), la regularización masiva de
// una jefatura no tiene un único tipo — recorre un rango de fechas que puede
// mezclar varios. Por eso este chequeo busca el motivo en todo el catálogo,
// no en un grupo puntual.
export function motivoRequiereRespaldo(motivo: string): boolean {
  const k = key(motivo);
  return Object.values(CATALOGO).some((lista) => lista.some((m) => key(m.v) === k && m.requiereRespaldo));
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
  respaldos?: number;
};

// Mensaje para la vista de solo lectura del funcionario: qué tiene que
// mandarle a su jefatura por conducto interno para que ella lo regularice
// acá — el funcionario nunca edita nada directamente.
export function accionSolicitada(c: { tipo: string; motivo: string; confirmada: boolean }): string {
  if (c.confirmada) return 'Ya fue regularizada por su jefatura. No necesita hacer nada más.';
  if (c.motivo) return 'Su jefatura ya está regularizando este caso.';
  const g = grupo(c.tipo);
  if (g === 'falta') {
    const p = pide(c.tipo);
    if (p.e && p.s) return 'Informe a su jefatura, por conducto interno, las horas reales de entrada y salida de ese día.';
    if (p.e) return 'Informe a su jefatura, por conducto interno, la hora real de entrada de ese día.';
    return 'Informe a su jefatura, por conducto interno, la hora real de salida de ese día.';
  }
  if (g === 'atraso') {
    return 'Informe a su jefatura, por conducto interno, la hora real de entrada de ese día, o si corresponde a un permiso, remita el respaldo correspondiente.';
  }
  return 'Si tiene un permiso, licencia médica u otro respaldo para esa fecha, entréguelo a su jefatura para que lo regularice.';
}

export function horaHabilitada(c: CasoEstado, horaSoloOlvido: boolean): boolean {
  const m = motivosDe(c.tipo).find((x) => x.v === c.motivo);
  if (!m || !m.hora) return false;
  return horaSoloOlvido ? /olvido/.test(key(m.v)) : true;
}

export function completa(c: CasoEstado, horaSoloOlvido: boolean): boolean {
  const m = motivosDe(c.tipo).find((x) => x.v === c.motivo);
  if (!m) return false;
  if (m.obs && !String(c.obs || '').trim()) return false;
  if (m.requiereMarca && marcas(c.tipo, c.entro ?? null, c.salio ?? null).e === 'sin marca') return false;
  if (m.requiereRespaldo && (c.respaldos ?? 0) < 1) return false;
  if (horaHabilitada(c, horaSoloOlvido)) {
    const p = pide(c.tipo);
    if (p.e && !c.entradaReal) return false;
    if (p.s && !c.salidaReal) return false;
  }
  return true;
}

export function tagClass(tipo: string): string {
  const t = key(tipo);
  if (/injustificada|inasistencia/.test(t)) return 'tag-neutral';
  if (/atraso|adelanto/.test(t)) return 'tag-outline';
  return 'tag-accent';
}

export function marcas(tipo: string, entro: string | null, salio: string | null) {
  const t = key(tipo);
  const faltaE = /falta entrada|injustificada|inasistencia/.test(t);
  const faltaS = /falta salida|injustificada|inasistencia/.test(t);
  return { e: faltaE ? 'sin marca' : entro || 'sin marca', s: faltaS ? 'sin marca' : salio || 'sin marca' };
}

export function fmtFecha(f: string): string {
  const d = new Date(f + 'T00:00:00');
  if (isNaN(d.getTime())) return f;
  return String(d.getDate()).padStart(2, '0') + ' ' + MESES[d.getMonth()].slice(0, 3);
}

export function diaSemana(f: string): string {
  const d = new Date(f + 'T00:00:00');
  return isNaN(d.getTime()) ? '' : DIAS[d.getDay()];
}

export function fechaLarga(f: string): string {
  const d = new Date(f + 'T00:00:00');
  if (isNaN(d.getTime())) return f;
  return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
}

export function slug(s: string): string {
  return key(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function nombreArchivo(periodo: string, alcance: string): string {
  return 'Regularizacion_marcajes_' + slug(periodo) + '_' + slug(alcance) + '.xlsx';
}

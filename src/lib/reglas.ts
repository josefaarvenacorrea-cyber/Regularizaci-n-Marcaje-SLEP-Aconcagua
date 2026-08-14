// Reglas de negocio de la regularización de marcajes — portadas 1:1 desde el
// prototipo `Regularización de Marcajes.dc.html` (catálogo de motivos, grupo
// por tipo de inconsistencia, qué hora pide cada caso, cuándo un caso está
// completo). Módulo compartido: lo usan tanto las rutas de API (validación
// autoritativa) como los componentes de UI (estado derivado).

export type Motivo = { v: string; hora?: boolean; obs?: boolean; requiereMarca?: boolean };

export const CATALOGO: Record<'falta' | 'atraso' | 'inasistencia', Motivo[]> = {
  falta: [
    { v: 'Olvido Involuntario', hora: true },
    { v: 'Problemas técnicos en dispositivos de marcaje', hora: true, obs: true },
    { v: 'Salida por emergencia o fuerza mayor', hora: true, obs: true },
    { v: 'Autorizar el descuento' },
  ],
  atraso: [
    { v: 'Permiso' },
    { v: 'Cometido Funcionario', obs: true },
    { v: 'Horas Compensatorias' },
    // El permiso gremial no exime de marcar: si el caso no tiene una marca de
    // entrada real (columna "Entró" del reloj control), este motivo no basta.
    { v: 'Permiso Gremial', requiereMarca: true },
    { v: 'Autorizar el descuento' },
  ],
  inasistencia: [
    { v: 'Permiso' },
    { v: 'Horas Compensatorias' },
    { v: 'Olvido Involuntario', hora: true },
    { v: 'Problemas Técnicos en Dispositivos de Marcaje', hora: true, obs: true },
    { v: 'Permiso Gremial' },
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

export function pide(tipo: string): { e: boolean; s: boolean } {
  const t = key(tipo);
  if (/falta entrada/.test(t)) return { e: true, s: false };
  if (/falta salida/.test(t)) return { e: false, s: true };
  if (grupo(tipo) === 'atraso') return { e: true, s: false };
  return { e: true, s: true };
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

import ExcelJS from 'exceljs';
import { key, normRut, titulo } from './reglas';

type Celda = { col: number; value: unknown };
type Grid = { headerCells: Celda[]; filas: Celda[][] };

async function gridFromXlsx(buffer: ArrayBuffer): Promise<Grid> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headerCells: [], filas: [] };
  const headerCells: Celda[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => headerCells.push({ col, value: cell.value }));
  const filas: Celda[][] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (row.cellCount === 0) continue;
    const cells: Celda[] = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => cells.push({ col, value: cell.value }));
    if (cells.length) filas.push(cells);
  }
  return { headerCells, filas };
}

function gridFromCsv(text: string): Grid {
  const lineas = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return { headerCells: [], filas: [] };
  const sep = (lineas[0].match(/;/g) || []).length > (lineas[0].match(/,/g) || []).length ? ';' : ',';
  const splitLine = (l: string) => l.split(sep).map((c) => c.replace(/^"|"$/g, ''));
  const headerCells = splitLine(lineas[0]).map((v, i) => ({ col: i + 1, value: v }));
  const filas = lineas.slice(1).map((l) => splitLine(l).map((v, i) => ({ col: i + 1, value: v })));
  return { headerCells, filas };
}

function indexar<K extends string>(headerCells: Celda[], matcher: (h: string) => K | null): Partial<Record<K, number>> {
  const idx: Partial<Record<K, number>> = {};
  for (const { col, value } of headerCells) {
    const campo = matcher(key(String(value ?? '')));
    if (campo && idx[campo] === undefined) idx[campo] = col;
  }
  return idx;
}

// Excel convierte automáticamente un correo escrito en una celda en un link
// (mailto:), y ExcelJS entrega esas celdas como { text, hyperlink } en vez de
// un string plano — igual que un texto con formato enriquecido llega como
// { richText: [...] }. Sin desenvolver esto, cualquier columna de texto con
// un correo "clickeable" se leería como "[object Object]".
function desenvolver(v: unknown): unknown {
  if (v && typeof v === 'object') {
    if ('text' in v && typeof (v as { text: unknown }).text === 'string') return (v as { text: string }).text;
    if ('richText' in v && Array.isArray((v as { richText: unknown }).richText)) {
      return (v as { richText: { text?: string }[] }).richText.map((r) => r.text || '').join('');
    }
    // Celda con fórmula: usamos el valor ya calculado que trae guardado el
    // archivo (igual que ve la persona que lo abrió en Excel/Sheets).
    if ('formula' in v && 'result' in v) return desenvolver((v as { result: unknown }).result);
  }
  return v;
}

function celda(fila: Celda[], idx: Partial<Record<string, number>>, campo: string): unknown {
  const c = idx[campo];
  if (c === undefined) return undefined;
  return desenvolver(fila.find((f) => f.col === c)?.value);
}

// ── Inconsistencias (reloj control) ─────────────────────────────────────

export type RegistroCarga = {
  rut: string;
  rutFmt: string;
  unidad: string;
  nombre: string;
  fecha: string;
  turno: string;
  tipo: string;
  entro: string | null;
  salio: string | null;
};

type CampoInc = 'ap' | 'no' | 'id' | 'un' | 'fe' | 'tu' | 'en' | 'sa' | 'ob';

function matchHeaderInc(h: string): CampoInc | null {
  if (/apellido/.test(h)) return 'ap';
  if (/^nombre/.test(h)) return 'no';
  if (/identificador|rut/.test(h)) return 'id';
  if (/grupo|unidad|depart/.test(h)) return 'un';
  if (/fecha/.test(h)) return 'fe';
  if (/turno/.test(h)) return 'tu';
  if (/entr/.test(h)) return 'en';
  if (/sali/.test(h)) return 'sa';
  if (/observado|inconsistencia/.test(h)) return 'ob';
  return null;
}

function horaDeCelda(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) {
    const hh = v.getUTCHours(),
      mm = v.getUTCMinutes();
    if (hh === 0 && mm === 0) return null;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  if (typeof v === 'number') {
    if (v === 0) return null;
    const m = Math.round(v * 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? m[1].padStart(2, '0') + ':' + m[2] : null;
}

function fechaDeCelda(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const s = String(v || '');
  const m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : s.slice(0, 10);
}

function registrosIncDesdeGrid({ headerCells, filas }: Grid): RegistroCarga[] {
  const idx = indexar(headerCells, matchHeaderInc);
  const registros: RegistroCarga[] = [];
  filas.forEach((fila) => {
    const tipo = String(celda(fila, idx, 'ob') ?? '').trim();
    if (!tipo || /^ninguno$/i.test(tipo)) return;
    const rutRaw = celda(fila, idx, 'id');
    // Sin RUT no hay forma de conciliar la fila entre cargas sucesivas ni de
    // cruzarla con la dotación — se descarta en vez de arriesgar que varias
    // filas sin identificador se pisen entre sí bajo la misma clave.
    if (!String(rutRaw ?? '').trim()) return;
    const nombre = String(celda(fila, idx, 'no') ?? '');
    const apellidos = String(celda(fila, idx, 'ap') ?? '');
    registros.push({
      rut: normRut(String(rutRaw ?? '')),
      rutFmt: String(rutRaw ?? ''),
      unidad: String(celda(fila, idx, 'un') ?? ''),
      nombre: (titulo(nombre) + ' ' + titulo(apellidos)).trim(),
      fecha: fechaDeCelda(celda(fila, idx, 'fe')),
      turno: String(celda(fila, idx, 'tu') ?? '') || 'No Planificado',
      tipo,
      entro: horaDeCelda(celda(fila, idx, 'en')),
      salio: horaDeCelda(celda(fila, idx, 'sa')),
    });
  });
  return registros;
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<RegistroCarga[]> {
  return registrosIncDesdeGrid(await gridFromXlsx(buffer));
}

export function parseCsv(text: string): RegistroCarga[] {
  return registrosIncDesdeGrid(gridFromCsv(text));
}

// ── Asistencia real de una persona (subsanar cruce con GeoVictoria) ────────

export type RegistroAsistencia = { fecha: string; entrada: string; salida: string };

type CampoAsist = 'fe' | 'en' | 'sa';

function matchHeaderAsist(h: string): CampoAsist | null {
  if (/fecha/.test(h)) return 'fe';
  if (/entr/.test(h)) return 'en';
  if (/sali/.test(h)) return 'sa';
  return null;
}

function registrosAsistDesdeGrid({ headerCells, filas }: Grid): RegistroAsistencia[] {
  const idx = indexar(headerCells, matchHeaderAsist);
  const registros: RegistroAsistencia[] = [];
  filas.forEach((fila) => {
    const fecha = fechaDeCelda(celda(fila, idx, 'fe'));
    if (!fecha) return;
    registros.push({
      fecha,
      entrada: horaDeCelda(celda(fila, idx, 'en')) || '',
      salida: horaDeCelda(celda(fila, idx, 'sa')) || '',
    });
  });
  return registros;
}

export async function parseXlsxAsistencia(buffer: ArrayBuffer): Promise<RegistroAsistencia[]> {
  return registrosAsistDesdeGrid(await gridFromXlsx(buffer));
}

export function parseCsvAsistencia(text: string): RegistroAsistencia[] {
  return registrosAsistDesdeGrid(gridFromCsv(text));
}

// ── Dotación efectiva ────────────────────────────────────────────────────

export type RegistroDotacion = {
  rut: string;
  nombre: string;
  area: string;
  cargo: string;
  estamento: string;
  correo: string;
  jefatura: string;
};

type CampoDot = 'rutdv' | 'rut' | 'dv' | 'nombre' | 'area' | 'cargo' | 'estamento' | 'correo' | 'jefatura';

function matchHeaderDot(h: string): CampoDot | null {
  if (/rut.*dv|rut-dv/.test(h)) return 'rutdv';
  if (/^rut$/.test(h)) return 'rut';
  if (/^dv$/.test(h)) return 'dv';
  if (/nombre/.test(h)) return 'nombre';
  if (/area|subdirec|depart|unidad/.test(h)) return 'area';
  if (/cargo/.test(h)) return 'cargo';
  if (/estamento/.test(h)) return 'estamento';
  if (/correo/.test(h)) return 'correo';
  if (/jefatura/.test(h)) return 'jefatura';
  return null;
}

function registrosDotDesdeGrid({ headerCells, filas }: Grid): RegistroDotacion[] {
  const idx = indexar(headerCells, matchHeaderDot);
  const registros: RegistroDotacion[] = [];
  filas.forEach((fila) => {
    const nombre = String(celda(fila, idx, 'nombre') ?? '').trim();
    if (!nombre) return;
    let rutRaw = String(celda(fila, idx, 'rutdv') ?? '').trim();
    if (!rutRaw) {
      const rutBase = String(celda(fila, idx, 'rut') ?? '').trim();
      const dv = String(celda(fila, idx, 'dv') ?? '').trim();
      rutRaw = dv ? rutBase + '-' + dv : rutBase;
    }
    if (!rutRaw) return;
    const jefaturaRaw = String(celda(fila, idx, 'jefatura') ?? '').trim();
    registros.push({
      rut: normRut(rutRaw),
      nombre,
      area: String(celda(fila, idx, 'area') ?? '').trim(),
      cargo: String(celda(fila, idx, 'cargo') ?? '').trim(),
      estamento: String(celda(fila, idx, 'estamento') ?? '').trim(),
      correo: String(celda(fila, idx, 'correo') ?? '').trim(),
      jefatura: jefaturaRaw,
    });
  });
  return registros;
}

export async function parseXlsxDotacion(buffer: ArrayBuffer): Promise<RegistroDotacion[]> {
  return registrosDotDesdeGrid(await gridFromXlsx(buffer));
}

export function parseCsvDotacion(text: string): RegistroDotacion[] {
  return registrosDotDesdeGrid(gridFromCsv(text));
}

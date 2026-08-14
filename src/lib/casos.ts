import { execute, query, queryOne, withTransaction } from './db';
import { key, normRut, completa as calcCompleta } from './reglas';
import type { Session } from './auth';
import type { PoolClient } from 'pg';

export type DotacionRow = {
  id: number;
  rut: string;
  nombre: string;
  area: string;
  cargo: string;
  estamento: string;
  correo: string;
  jefatura: string;
};

export type IncRow = {
  id: string;
  rut: string;
  rut_fmt: string;
  nombre: string;
  unidad: string;
  fecha: string;
  turno: string;
  tipo: string;
  entro: string | null;
  salio: string | null;
  periodo: string;
  jefatura: string | null;
  identificado: number;
  motivo: string;
  entrada_real: string;
  salida_real: string;
  obs: string;
  respaldo: string;
  updated_at: string;
};

export type Caso = {
  id: string;
  rut: string;
  rutFmt: string;
  nombre: string;
  unidad: string;
  cargo: string;
  fecha: string;
  turno: string;
  tipo: string;
  entro: string | null;
  salio: string | null;
  jefatura: string | null;
  identificado: boolean;
  motivo: string;
  entradaReal: string;
  salidaReal: string;
  obs: string;
  respaldo: string;
  completa: boolean;
};

export async function getConfig(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM config');
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function getConfigBool(k: string, def = false): Promise<boolean> {
  const cfg = await getConfig();
  const v = cfg[k];
  return v === undefined ? def : v === 'true';
}

export async function setConfig(k: string, v: string): Promise<void> {
  await execute('INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
}

export async function loadDotacion(): Promise<DotacionRow[]> {
  return query<DotacionRow>('SELECT * FROM dotacion');
}

function jerarquiaMap(dot: DotacionRow[]): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const d of dot) {
    if (!d.nombre) continue;
    m.set(key(d.nombre), d.jefatura && d.jefatura !== '-' ? key(d.jefatura) : null);
  }
  return m;
}

function cadena(jer: Map<string, string | null>, k: string): string[] {
  const out: string[] = [];
  let cur: string | null = k;
  let n = 0;
  while (cur && n++ < 12) {
    const j: string | null = jer.get(cur) ?? null;
    if (!j || out.indexOf(j) >= 0) break;
    out.push(j);
    cur = j;
  }
  return out;
}

function toCaso(r: IncRow, dotByRut: Map<string, DotacionRow>, horaSoloOlvido: boolean): Caso {
  const d = dotByRut.get(r.rut);
  const c: Caso = {
    id: r.id,
    rut: r.rut,
    rutFmt: r.rut_fmt || r.rut,
    nombre: r.nombre,
    unidad: d ? d.area : r.unidad,
    cargo: d ? d.cargo : 'Sin cargo en la dotación',
    fecha: r.fecha,
    turno: r.turno,
    tipo: r.tipo,
    entro: r.entro,
    salio: r.salio,
    jefatura: r.jefatura,
    identificado: !!r.identificado,
    motivo: r.motivo,
    entradaReal: r.entrada_real,
    salidaReal: r.salida_real,
    obs: r.obs,
    respaldo: r.respaldo,
    completa: false,
  };
  c.completa = calcCompleta(
    { tipo: c.tipo, motivo: c.motivo, entradaReal: c.entradaReal, salidaReal: c.salidaReal, obs: c.obs, entro: c.entro, salio: c.salio },
    horaSoloOlvido
  );
  return c;
}

export async function allCasos(): Promise<Caso[]> {
  const [rows, dot, horaSoloOlvido] = await Promise.all([
    query<IncRow>('SELECT * FROM inconsistencias'),
    loadDotacion(),
    getConfigBool('horaSoloOlvido', false),
  ]);
  const dotByRut = new Map(dot.map((d) => [d.rut, d]));
  return rows.map((r) => toCaso(r, dotByRut, horaSoloOlvido));
}

// Casos visibles para la sesión actual: equipo de la jefatura (directo, o en
// cascada si está habilitado), o todo el servicio / huérfanos para admin.
export async function misCasos(session: Session, opts: { verHuerfanos?: boolean } = {}): Promise<Caso[]> {
  const todos = await allCasos();
  if (session.rol === 'admin') {
    return opts.verHuerfanos ? todos.filter((c) => !c.jefatura) : todos;
  }
  const [dot, cascada] = await Promise.all([loadDotacion(), getConfigBool('cascada', false)]);
  const jer = jerarquiaMap(dot);
  const pk = key(session.nombre);
  return todos.filter((c) => {
    if (!c.jefatura) return false;
    if (key(c.jefatura) === pk) return true;
    if (!cascada) return false;
    return cadena(jer, key(c.nombre)).indexOf(pk) >= 0;
  });
}

export async function getCasoById(id: string): Promise<IncRow | undefined> {
  return queryOne<IncRow>('SELECT * FROM inconsistencias WHERE id = $1', [id]);
}

export async function getCasoFormatted(id: string): Promise<Caso | undefined> {
  const row = await getCasoById(id);
  if (!row) return undefined;
  const [dot, horaSoloOlvido] = await Promise.all([loadDotacion(), getConfigBool('horaSoloOlvido', false)]);
  const dotByRut = new Map(dot.map((d) => [d.rut, d]));
  return toCaso(row, dotByRut, horaSoloOlvido);
}

// Verifica que el caso `id` esté dentro del alcance visible de la sesión
// (usado antes de aplicar cualquier PATCH, para que una jefatura no pueda
// modificar casos de otro equipo aunque conozca el id).
export async function casoVisiblePara(session: Session, id: string): Promise<boolean> {
  if (session.rol === 'admin') return true;
  const mios = await misCasos(session, {});
  return mios.some((c) => c.id === id);
}

async function siguienteId(client: PoolClient): Promise<string> {
  const row = await client.query<{ value: string }>('SELECT value FROM meta WHERE key = $1', ['inc_seq']);
  const n = (row.rows[0] ? parseInt(row.rows[0].value, 10) : 0) + 1;
  await client.query(
    'INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    ['inc_seq', String(n)]
  );
  return 'INC-' + String(n).padStart(5, '0');
}

// Clave de negocio para reconciliar una fila del reloj control con un caso ya
// existente entre cargas sucesivas: mismo funcionario, misma fecha, mismo
// tipo de inconsistencia.
function claveCaso(rut: string, fecha: string, tipo: string): string {
  return rut + '::' + fecha + '::' + key(tipo);
}

export type ResultadoCarga = {
  casosAsignados: number;
  casosSinJefatura: number;
  casosNoIdentificados: number;
  totalGlobal: number;
  personasGlobal: number;
  nuevos: number;
  actualizados: number;
  sinCambios: number;
};

// Incorpora una carga del reloj control a la base vigente del período: no la
// reemplaza por completo (eso borraría el trabajo de las jefaturas cada vez
// que se sube un archivo nuevo), sino que la concilia por funcionario+fecha+
// tipo — una fila que ya existía actualiza sus datos crudos (nombre, turno,
// marcas, unidad) pero nunca toca la justificación ya ingresada; una fila
// nueva se agrega en blanco. Nunca elimina filas: si una carga viene
// incompleta o es solo un lote parcial (p. ej. la semana en curso), los casos
// de cargas anteriores que no vuelven a aparecer se conservan igual.
export async function actualizarBase(
  registros: { rut: string; rutFmt: string; unidad: string; nombre: string; fecha: string; turno: string; tipo: string; entro: string | null; salio: string | null }[],
  origenNombre: string
): Promise<ResultadoCarga> {
  const [dot, config] = await Promise.all([loadDotacion(), getConfig()]);
  const dotByRut = new Map(dot.map((d) => [d.rut, d]));
  const now = new Date().toISOString();
  const periodo = config.periodo || '';

  let nuevos = 0;
  let actualizados = 0;
  let sinCambios = 0;

  await withTransaction(async (client) => {
    const existentes = (await client.query<IncRow>('SELECT * FROM inconsistencias')).rows;
    const porClave = new Map(existentes.map((r) => [claveCaso(r.rut, r.fecha, r.tipo), r]));

    for (const r of registros) {
      const clave = claveCaso(r.rut, r.fecha, r.tipo);
      const d = dotByRut.get(r.rut);
      const jefatura = d ? (d.jefatura && d.jefatura !== '-' ? d.jefatura : '') : null;
      const identificado = d ? 1 : 0;
      const existente = porClave.get(clave);

      if (!existente) {
        const id = await siguienteId(client);
        await client.query(
          `INSERT INTO inconsistencias
            (id, rut, rut_fmt, nombre, unidad, fecha, turno, tipo, entro, salio, periodo, jefatura, identificado, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [id, r.rut, r.rutFmt || r.rut, r.nombre, d ? d.area : r.unidad, r.fecha, r.turno, r.tipo, r.entro, r.salio, periodo, jefatura, identificado, now]
        );
        nuevos++;
        continue;
      }

      const unidad = d ? d.area : r.unidad;
      const sinCambio =
        existente.rut_fmt === (r.rutFmt || r.rut) &&
        existente.nombre === r.nombre &&
        existente.unidad === unidad &&
        existente.turno === r.turno &&
        existente.entro === r.entro &&
        existente.salio === r.salio &&
        existente.jefatura === jefatura &&
        existente.identificado === identificado;
      if (sinCambio) {
        sinCambios++;
        continue;
      }
      await client.query(
        `UPDATE inconsistencias
         SET rut_fmt=$1, nombre=$2, unidad=$3, turno=$4, entro=$5, salio=$6, jefatura=$7, identificado=$8, updated_at=$9
         WHERE id=$10`,
        [r.rutFmt || r.rut, r.nombre, unidad, r.turno, r.entro, r.salio, jefatura, identificado, now, existente.id]
      );
      actualizados++;
    }
  });
  await setConfig('origen', origenNombre);

  const todos = await allCasos();
  return {
    casosAsignados: todos.filter((c) => c.jefatura).length,
    casosSinJefatura: todos.filter((c) => c.jefatura === '').length,
    casosNoIdentificados: todos.filter((c) => c.jefatura === null).length,
    totalGlobal: todos.length,
    personasGlobal: new Set(todos.map((c) => c.rut)).size,
    nuevos,
    actualizados,
    sinCambios,
  };
}

export type ResultadoDotacion = {
  funcionarios: number;
  jefaturas: number;
  casosRecalculados: number;
};

// Reemplaza la dotación completa (a diferencia de las inconsistencias, la
// dotación vigente es un snapshot único de la estructura organizacional, no
// algo que tenga sentido conciliar fila a fila) y vuelve a resolver la
// jefatura/unidad de cada inconsistencia ya cargada contra la dotación nueva,
// porque esos valores quedan guardados en la fila al momento de cargarla o
// actualizarla y, si no se recalculan, quedarían desactualizados.
export async function reemplazarDotacion(
  registros: { rut: string; nombre: string; area: string; cargo: string; estamento: string; correo: string; jefatura: string }[]
): Promise<ResultadoDotacion> {
  let casosRecalculados = 0;
  await withTransaction(async (client) => {
    await client.query('DELETE FROM dotacion');
    for (const d of registros) {
      await client.query(
        'INSERT INTO dotacion (rut, nombre, area, cargo, estamento, correo, jefatura) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [d.rut, d.nombre, d.area, d.cargo, d.estamento, d.correo, d.jefatura]
      );
    }

    const dotByRut = new Map(registros.map((d) => [d.rut, d]));
    const casos = (await client.query<IncRow>('SELECT id, rut, jefatura, identificado, unidad FROM inconsistencias')).rows;
    const now = new Date().toISOString();
    for (const c of casos) {
      const d = dotByRut.get(c.rut);
      const jefatura = d ? (d.jefatura && d.jefatura !== '-' ? d.jefatura : '') : null;
      const identificado = d ? 1 : 0;
      const unidad = d ? d.area : c.unidad;
      if (c.jefatura === jefatura && c.identificado === identificado && c.unidad === unidad) continue;
      await client.query('UPDATE inconsistencias SET jefatura=$1, identificado=$2, unidad=$3, updated_at=$4 WHERE id=$5', [
        jefatura,
        identificado,
        unidad,
        now,
        c.id,
      ]);
      casosRecalculados++;
    }
  });

  const nombresJefes = new Set(registros.map((d) => d.jefatura).filter((j) => j && j !== '-'));
  return { funcionarios: registros.length, jefaturas: nombresJefes.size, casosRecalculados };
}

export { normRut };

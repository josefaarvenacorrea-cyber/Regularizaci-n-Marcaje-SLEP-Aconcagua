import { execute, query, queryOne, withTransaction } from './db';
import { key, normRut, completa as calcCompleta, corregirTipoAtraso, pide } from './reglas';
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
  confirmada: boolean;
};

export type RespaldoMeta = {
  id: number;
  casoId: string;
  nombreArchivo: string;
  mimetype: string;
  tamano: number;
  subidoPor: string;
  creadoEn: string;
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
  respaldos: number;
  completa: boolean;
  confirmada: boolean;
};

export type LoginIntentos = { fallidos: number; bloqueadoHasta: string };

// Estado de intentos fallidos de login, por correo (clave normalizada en
// minúsculas por quien llama). Sirve para bloquear una cuenta un rato
// después de varios intentos seguidos — la contraseña es corta (4 dígitos),
// así que sin esto un script podría probarlas todas en segundos.
export async function getLoginIntentos(correo: string): Promise<LoginIntentos> {
  const row = await queryOne<{ fallidos: number; bloqueado_hasta: string }>(
    'SELECT fallidos, bloqueado_hasta FROM login_intentos WHERE correo = $1',
    [correo]
  );
  return { fallidos: row?.fallidos ?? 0, bloqueadoHasta: row?.bloqueado_hasta ?? '' };
}

export async function registrarIntentoFallido(correo: string, maxIntentos: number, bloqueoMinutos: number): Promise<void> {
  const actual = await getLoginIntentos(correo);
  const fallidos = actual.fallidos + 1;
  const bloqueadoHasta = fallidos >= maxIntentos ? new Date(Date.now() + bloqueoMinutos * 60000).toISOString() : actual.bloqueadoHasta;
  await execute(
    `INSERT INTO login_intentos (correo, fallidos, bloqueado_hasta) VALUES ($1,$2,$3)
     ON CONFLICT (correo) DO UPDATE SET fallidos = EXCLUDED.fallidos, bloqueado_hasta = EXCLUDED.bloqueado_hasta`,
    [correo, fallidos, bloqueadoHasta]
  );
}

export async function limpiarIntentosLogin(correo: string): Promise<void> {
  await execute('DELETE FROM login_intentos WHERE correo = $1', [correo]);
}
export async function getConfig(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM config');
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// Contraseña propia que la persona eligió al reemplazar la temporal (los
// primeros 4 dígitos de su RUT). Mientras no exista una fila acá, el login
// sigue aceptando la temporal y obliga a cambiarla; una vez que la elige, la
// temporal deja de servir.
export async function getClaveCustom(correo: string): Promise<string | null> {
  const row = await queryOne<{ clave_hash: string }>('SELECT clave_hash FROM login_claves WHERE correo = $1', [correo]);
  return row?.clave_hash ?? null;
}

export async function setClaveCustom(correo: string, claveHash: string): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO login_claves (correo, clave_hash, actualizado_en) VALUES ($1,$2,$3)
     ON CONFLICT (correo) DO UPDATE SET clave_hash = EXCLUDED.clave_hash, actualizado_en = EXCLUDED.actualizado_en`,
    [correo, claveHash, now]
  );
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

function toCaso(r: IncRow, dotByRut: Map<string, DotacionRow>, horaSoloOlvido: boolean, respaldos = 0): Caso {
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
    respaldos,
    completa: false,
    confirmada: !!r.confirmada,
  };
    c.completa = calcCompleta(
    { tipo: c.tipo, motivo: c.motivo, entradaReal: c.entradaReal, salidaReal: c.salidaReal, obs: c.obs, entro: c.entro, salio: c.salio, respaldos: c.respaldos },
    horaSoloOlvido
  );
  
  return c;
}

async function respaldoCounts(): Promise<Map<string, number>> {
  const rows = await query<{ caso_id: string; n: string }>('SELECT caso_id, COUNT(*)::text AS n FROM respaldos GROUP BY caso_id');
  return new Map(rows.map((r) => [r.caso_id, parseInt(r.n, 10)]));
}

export async function allCasos(): Promise<Caso[]> {
  const [rows, dot, horaSoloOlvido, respCounts] = await Promise.all([
    query<IncRow>('SELECT * FROM inconsistencias'),
    loadDotacion(),
    getConfigBool('horaSoloOlvido', false),
    respaldoCounts(),
  ]);
  const dotByRut = new Map(dot.map((d) => [d.rut, d]));
  return rows.map((r) => toCaso(r, dotByRut, horaSoloOlvido, respCounts.get(r.id) || 0));
}

// Casos visibles para la sesión actual: equipo de la jefatura (directo, o en
// cascada si está habilitado), o todo el servicio / huérfanos para admin.
export async function misCasos(session: Session, opts: { verHuerfanos?: boolean } = {}): Promise<Caso[]> {
  const todos = await allCasos();
  if (session.rol === 'admin') {
    return opts.verHuerfanos ? todos.filter((c) => !c.jefatura) : todos;
  }
  if (session.rol === 'funcionario') {
    return todos.filter((c) => c.rut === session.rut);
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
  const [dot, horaSoloOlvido, n] = await Promise.all([
    loadDotacion(),
    getConfigBool('horaSoloOlvido', false),
    queryOne<{ n: string }>('SELECT COUNT(*)::text AS n FROM respaldos WHERE caso_id = $1', [id]),
  ]);
  const dotByRut = new Map(dot.map((d) => [d.rut, d]));
  return toCaso(row, dotByRut, horaSoloOlvido, n ? parseInt(n.n, 10) : 0);
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
      // El "Observado" del reloj control a veces marca Atraso en días donde
      // la entrada en realidad cayó dentro del margen de tolerancia del
      // turno — no era un atraso real. Se corrige acá, antes de calcular la
      // clave de negocio, para que quede bien clasificado desde la carga.
      const tipoCorregido = corregirTipoAtraso(r.tipo, r.turno, r.entro, r.salio);
      if (tipoCorregido === null) continue; // no es una inconsistencia real
      const tipo = tipoCorregido ?? r.tipo;

      const clave = claveCaso(r.rut, r.fecha, tipo);
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
          [id, r.rut, r.rutFmt || r.rut, r.nombre, d ? d.area : r.unidad, r.fecha, r.turno, tipo, r.entro, r.salio, periodo, jefatura, identificado, now]
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

export type ResultadoCorreccionAtraso = { reclasificados: number; eliminados: number };

// Corrección de una vez para los casos "Atraso" que ya están cargados desde
// antes de que `actualizarBase` aplicara `corregirTipoAtraso` en la carga
// misma (ver ahí el porqué). No usa la clave de negocio de actualizarBase
// porque acá se actualiza directo por id, sobre filas que ya existen.
export async function corregirClasificacionAtrasoExistente(): Promise<ResultadoCorreccionAtraso> {
  const rows = await query<IncRow>(`SELECT * FROM inconsistencias WHERE tipo = 'Atraso'`);
  const now = new Date().toISOString();
  let reclasificados = 0;
  let eliminados = 0;
  for (const r of rows) {
    const resultado = corregirTipoAtraso(r.tipo, r.turno, r.entro, r.salio);
    if (resultado === undefined) continue;
    if (resultado === null) {
      await execute('DELETE FROM inconsistencias WHERE id = $1', [r.id]);
      eliminados++;
    } else {
      await execute('UPDATE inconsistencias SET tipo = $1, updated_at = $2 WHERE id = $3', [resultado, now, r.id]);
      reclasificados++;
    }
  }
  return { reclasificados, eliminados };
}

export type ResultadoRegularizacionMasiva = { afectados: number };

// Regulariza en bloque todos los casos pendientes de una fecha con el mismo
// motivo y horario — pensado para días excepcionales donde casi todo el
// personal queda con inconsistencias por la misma razón (p. ej. la puesta en
// marcha del reloj control). Nunca toca un caso que la jefatura ya haya
// enviado: solo alcanza a los que siguen pendientes.
export async function regularizarMasivoPorFecha(
  fecha: string,
  motivo: string,
  horaEntrada: string,
  horaSalida: string
): Promise<ResultadoRegularizacionMasiva> {
  const rows = await query<IncRow>('SELECT * FROM inconsistencias WHERE fecha = $1 AND confirmada = false', [fecha]);
  const now = new Date().toISOString();
  let afectados = 0;
  for (const r of rows) {
    const p = pide(r.tipo);
    await execute(
      `UPDATE inconsistencias SET motivo=$1, entrada_real=$2, salida_real=$3, confirmada=true, updated_at=$4 WHERE id=$5`,
      [motivo, p.e ? horaEntrada : '', p.s ? horaSalida : '', now, r.id]
    );
    afectados++;
  }
  return { afectados };
}
export type ResultadoRegularizacionMasivaJefatura = { afectados: string[] };

// Igual que regularizarMasivoPorFecha, pero acotado al equipo de una
// jefatura (respetando cascada si está habilitada, igual que misCasos) y a
// un rango de fechas en vez de una fecha única — pensado para cuando el
// equipo completo sale a una actividad grupal por varios días. Devuelve los
// ids afectados para que quien llama pueda, por ejemplo, adjuntarles a todos
// el mismo documento de respaldo.
export async function regularizarMasivoParaJefatura(
  session: Session,
  fechaDesde: string,
  fechaHasta: string,
  motivo: string,
  horaEntrada: string,
  horaSalida: string
): Promise<ResultadoRegularizacionMasivaJefatura> {
  const mios = await misCasos(session, {});
  const pendientes = mios.filter((c) => !c.confirmada && c.fecha >= fechaDesde && c.fecha <= fechaHasta);
  const now = new Date().toISOString();
  const afectados: string[] = [];
  for (const c of pendientes) {
    const p = pide(c.tipo);
    await execute(
      `UPDATE inconsistencias SET motivo=$1, entrada_real=$2, salida_real=$3, confirmada=true, updated_at=$4 WHERE id=$5`,
      [motivo, p.e ? horaEntrada : '', p.s ? horaSalida : '', now, c.id]
    );
    afectados.push(c.id);
  }
  return { afectados };
}
export type JefaturaResumen = {
  nombre: string;
  correo: string;
  area: string;
  cargo: string;
  equipo: number;
  casos: number;
  resueltos: number;
  pct: number;
};

// Avance por jefatura (casos asignados vs. confirmados) — usado tanto por el
// panel de avance como por el recordatorio de plazo, para no duplicar esta
// cuenta en dos rutas de API.
export async function jefaturasResumen(): Promise<JefaturaResumen[]> {
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
  return nombresJefes
    .map((nom) => {
      const k = key(nom);
      const ficha = dot.find((d) => key(d.nombre) === k);
      const c = conteo.get(k) || { casos: 0, res: 0 };
      return {
        nombre: nom,
        correo: ficha?.correo || '',
        area: ficha?.area || '—',
        cargo: ficha?.cargo || 'Jefatura',
        equipo: dot.filter((d) => key(d.jefatura || '') === k).length,
        casos: c.casos,
        resueltos: c.res,
        pct: c.casos ? Math.round((c.res / c.casos) * 100) : 0,
      };
    })
    .sort((a, b) => b.casos - b.resueltos - (a.casos - a.resueltos));
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

type RespaldoRow = {
  id: number;
  caso_id: string;
  nombre_archivo: string;
  mimetype: string;
  tamano: number;
  subido_por: string;
  creado_en: string;
};

function toRespaldoMeta(r: RespaldoRow): RespaldoMeta {
  return {
    id: r.id,
    casoId: r.caso_id,
    nombreArchivo: r.nombre_archivo,
    mimetype: r.mimetype,
    tamano: r.tamano,
    subidoPor: r.subido_por,
    creadoEn: r.creado_en,
  };
}

export async function listRespaldos(casoId: string): Promise<RespaldoMeta[]> {
  const rows = await query<RespaldoRow>(
    'SELECT id, caso_id, nombre_archivo, mimetype, tamano, subido_por, creado_en FROM respaldos WHERE caso_id = $1 ORDER BY id',
    [casoId]
  );
  return rows.map(toRespaldoMeta);
}

export async function insertRespaldo(
  casoId: string,
  nombreArchivo: string,
  mimetype: string,
  contenido: Buffer,
  subidoPor: string
): Promise<RespaldoMeta> {
  const now = new Date().toISOString();
  const row = await queryOne<RespaldoRow>(
    `INSERT INTO respaldos (caso_id, nombre_archivo, mimetype, tamano, contenido, subido_por, creado_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, caso_id, nombre_archivo, mimetype, tamano, subido_por, creado_en`,
    [casoId, nombreArchivo, mimetype, contenido.length, contenido, subidoPor, now]
  );
  return toRespaldoMeta(row!);
}

export async function getRespaldoContenido(
  id: number
): Promise<{ casoId: string; nombreArchivo: string; mimetype: string; contenido: Buffer } | undefined> {
  const row = await queryOne<{ caso_id: string; nombre_archivo: string; mimetype: string; contenido: Buffer }>(
    'SELECT caso_id, nombre_archivo, mimetype, contenido FROM respaldos WHERE id = $1',
    [id]
  );
  if (!row) return undefined;
  return { casoId: row.caso_id, nombreArchivo: row.nombre_archivo, mimetype: row.mimetype, contenido: row.contenido };
}

// Para poder autorizar un DELETE antes de tocar el archivo (misma regla que
// una descarga: hay que saber a qué caso pertenece para validar visibilidad).
export async function getRespaldoCasoId(id: number): Promise<string | undefined> {
  const row = await queryOne<{ caso_id: string }>('SELECT caso_id FROM respaldos WHERE id = $1', [id]);
  return row?.caso_id;
}

export async function deleteRespaldo(id: number): Promise<boolean> {
  const n = await execute('DELETE FROM respaldos WHERE id = $1', [id]);
  return n > 0;
}

export type RespaldoCasoGrupo = {
  casoId: string;
  fecha: string;
  tipo: string;
  motivo: string;
  archivos: RespaldoMeta[];
};

export type RespaldoPersonaGrupo = {
  rut: string;
  nombre: string;
  casos: RespaldoCasoGrupo[];
};

// Vista "carpeta grande": todos los archivos adjuntos, agrupados por persona
// y dentro de cada persona por caso — para que Gestión de Personas los pueda
// recorrer igual que si fueran carpetas, sin depender de un disco compartido
// (que esta app, al correr en Vercel, no tiene).
export async function respaldosPorPersonaYCaso(): Promise<RespaldoPersonaGrupo[]> {
  const rows = await query<
    RespaldoRow & { rut: string; nombre: string; fecha: string; tipo: string; motivo: string }
  >(
    `SELECT r.id, r.caso_id, r.nombre_archivo, r.mimetype, r.tamano, r.subido_por, r.creado_en,
            i.rut, i.nombre, i.fecha, i.tipo, i.motivo
     FROM respaldos r
     JOIN inconsistencias i ON i.id = r.caso_id
     ORDER BY i.nombre, i.fecha, r.id`
  );

  const porPersona = new Map<string, RespaldoPersonaGrupo>();
  for (const r of rows) {
    let persona = porPersona.get(r.rut);
    if (!persona) {
      persona = { rut: r.rut, nombre: r.nombre, casos: [] };
      porPersona.set(r.rut, persona);
    }
    let grupo = persona.casos.find((c) => c.casoId === r.caso_id);
    if (!grupo) {
      grupo = { casoId: r.caso_id, fecha: r.fecha, tipo: r.tipo, motivo: r.motivo, archivos: [] };
      persona.casos.push(grupo);
    }
    grupo.archivos.push(toRespaldoMeta(r));
  }
  return [...porPersona.values()];
}

export { normRut };

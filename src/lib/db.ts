import { Pool, type PoolClient } from 'pg';

// Vercel prefija las variables que genera la integración de Postgres con el
// nombre que le hayas puesto al recurso de Storage (p. ej. "Almacenamiento"
// → ALMACENAMIENTO_DATABASE_URL) en vez de crear una POSTGRES_URL/DATABASE_URL
// simple. En vez de depender de que alguien copie ese valor a mano a una
// variable con el nombre exacto (frágil: un solo error de tipeo o de guardado
// y la app queda sin base de datos sin avisar hasta el primer request real),
// se busca cualquier variable de entorno cuyo nombre termine en
// _DATABASE_URL o _POSTGRES_URL, prefiriendo la versión "pooled" (sin
// _UNPOOLED/_NO_SSL/_PRISMA/_NON_POOLING) por ser la adecuada para funciones
// serverless.
function resolveConnectionString(): string {
  const directo = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (directo) return directo;

  const candidatos = Object.keys(process.env).filter((k) => /(_|^)(DATABASE|POSTGRES)_URL$/.test(k));
  const pooled = candidatos.find((k) => !/UNPOOLED|NO_SSL|PRISMA|NON_POOLING/.test(k));
  const elegido = pooled || candidatos[0];
  if (elegido) return process.env[elegido]!;

  throw new Error(
    'Falta POSTGRES_URL (o DATABASE_URL, o alguna variable *_DATABASE_URL/*_POSTGRES_URL): defínela en .env.local para desarrollo, o conecta el storage de Postgres al proyecto en Vercel.'
  );
}

const connectionString = resolveConnectionString();

declare global {
  var __pgPool: Pool | undefined;
  var __schemaReady: Promise<void> | undefined;
}

function getPool(): Pool {
  if (!global.__pgPool) {
    global.__pgPool = new Pool({
      connectionString,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
    });
  }
  return global.__pgPool;
}

async function ensureSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dotacion (
      id SERIAL PRIMARY KEY,
      rut TEXT NOT NULL,
      nombre TEXT NOT NULL,
      area TEXT NOT NULL DEFAULT '',
      cargo TEXT NOT NULL DEFAULT '',
      estamento TEXT NOT NULL DEFAULT '',
      correo TEXT NOT NULL DEFAULT '',
      jefatura TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_dotacion_rut ON dotacion(rut);
    CREATE INDEX IF NOT EXISTS idx_dotacion_correo ON dotacion(correo);

    CREATE TABLE IF NOT EXISTS inconsistencias (
      id TEXT PRIMARY KEY,
      rut TEXT NOT NULL,
      rut_fmt TEXT NOT NULL DEFAULT '',
      nombre TEXT NOT NULL DEFAULT '',
      unidad TEXT NOT NULL DEFAULT '',
      fecha TEXT NOT NULL DEFAULT '',
      turno TEXT NOT NULL DEFAULT '',
      tipo TEXT NOT NULL DEFAULT '',
      entro TEXT,
      salio TEXT,
      periodo TEXT NOT NULL DEFAULT '',
      jefatura TEXT,
      identificado INTEGER NOT NULL DEFAULT 0,
      motivo TEXT NOT NULL DEFAULT '',
      entrada_real TEXT NOT NULL DEFAULT '',
      salida_real TEXT NOT NULL DEFAULT '',
      obs TEXT NOT NULL DEFAULT '',
      respaldo TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '',
      confirmada BOOLEAN NOT NULL DEFAULT false
    );
    ALTER TABLE inconsistencias ADD COLUMN IF NOT EXISTS confirmada BOOLEAN NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_inc_jefatura ON inconsistencias(jefatura);
    CREATE INDEX IF NOT EXISTS idx_inc_rut ON inconsistencias(rut);

    CREATE TABLE IF NOT EXISTS respaldos (
      id SERIAL PRIMARY KEY,
      caso_id TEXT NOT NULL REFERENCES inconsistencias(id) ON DELETE CASCADE,
      nombre_archivo TEXT NOT NULL,
      mimetype TEXT NOT NULL DEFAULT '',
      tamano INTEGER NOT NULL DEFAULT 0,
      contenido BYTEA NOT NULL,
      subido_por TEXT NOT NULL DEFAULT '',
      creado_en TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_respaldos_caso ON respaldos(caso_id);

    CREATE TABLE IF NOT EXISTS archivos_generados (
      id SERIAL PRIMARY KEY,
      archivo TEXT NOT NULL,
      jefatura TEXT NOT NULL,
      filas INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      alcance TEXT NOT NULL DEFAULT '',
      contenido BYTEA
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

       CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_intentos (
      correo TEXT PRIMARY KEY,
      fallidos INTEGER NOT NULL DEFAULT 0,
      bloqueado_hasta TEXT NOT NULL DEFAULT ''
    );
  `);
      CREATE TABLE IF NOT EXISTS login_claves (
      correo TEXT PRIMARY KEY,
      clave_hash TEXT NOT NULL,
      actualizado_en TEXT NOT NULL DEFAULT ''
    );
}

// Garantiza que el esquema exista antes de la primera consulta de este
// proceso; las siguientes llamadas reutilizan la misma promesa ya resuelta.
async function ready(): Promise<Pool> {
  const pool = getPool();
  if (!global.__schemaReady) global.__schemaReady = ensureSchema(pool);
  await global.__schemaReady;
  return pool;
}

export type Row = Record<string, unknown>;

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const pool = await ready();
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export async function execute(text: string, params: unknown[] = []): Promise<number> {
  const pool = await ready();
  const res = await pool.query(text, params);
  return res.rowCount ?? 0;
}

// Transacción real: todas las consultas dentro de `fn` corren sobre el mismo
// cliente reservado del pool, con BEGIN/COMMIT/ROLLBACK.
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = await ready();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

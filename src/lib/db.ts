import { Pool, type PoolClient } from 'pg';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'Falta POSTGRES_URL (o DATABASE_URL): defínela en .env.local para desarrollo, o como variable de entorno del proyecto en Vercel (la agrega sola al conectar el storage de Postgres).'
  );
}

declare global {
  var __pgPool: Pool | undefined;
  var __schemaReady: Promise<void> | undefined;
}

function getPool(): Pool {
  if (!global.__pgPool) {
    global.__pgPool = new Pool({
      connectionString,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString!) ? false : { rejectUnauthorized: false },
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
      updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_inc_jefatura ON inconsistencias(jefatura);
    CREATE INDEX IF NOT EXISTS idx_inc_rut ON inconsistencias(rut);

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
  `);
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

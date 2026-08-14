// Carga la dotación efectiva y el compilado de inconsistencias de muestra
// (bundle de diseño en ../../project) en Postgres como datos semilla / demo.
// Uso: npm run seed (lee POSTGRES_URL desde .env.local o del entorno)
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PROJECT_DIR = path.join(ROOT, '..', 'project');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Falta POSTGRES_URL (o DATABASE_URL) — define .env.local o exporta la variable antes de correr la semilla.');
}
const pool = new Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
});

function readGlobalArray(file, varName) {
  const txt = fs.readFileSync(file, 'utf8');
  const marker = `window.${varName} = `;
  const start = txt.indexOf(marker);
  if (start < 0) throw new Error(`No se encontró ${marker} en ${file}`);
  let body = txt.slice(start + marker.length).trim();
  if (body.endsWith(';')) body = body.slice(0, -1);
  return JSON.parse(body);
}

function normRut(s) {
  return String(s || '').replace(/[.\s]/g, '').toUpperCase();
}
function titulo(s) {
  return String(s || '').trim().toLowerCase().replace(/(^|[\s'-])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase());
}

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dotacion (
      id SERIAL PRIMARY KEY,
      rut TEXT NOT NULL, nombre TEXT NOT NULL, area TEXT NOT NULL DEFAULT '',
      cargo TEXT NOT NULL DEFAULT '', estamento TEXT NOT NULL DEFAULT '',
      correo TEXT NOT NULL DEFAULT '', jefatura TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_dotacion_rut ON dotacion(rut);
    CREATE INDEX IF NOT EXISTS idx_dotacion_correo ON dotacion(correo);

    CREATE TABLE IF NOT EXISTS inconsistencias (
      id TEXT PRIMARY KEY, rut TEXT NOT NULL, rut_fmt TEXT NOT NULL DEFAULT '',
      nombre TEXT NOT NULL DEFAULT '', unidad TEXT NOT NULL DEFAULT '',
      fecha TEXT NOT NULL DEFAULT '', turno TEXT NOT NULL DEFAULT '',
      tipo TEXT NOT NULL DEFAULT '', entro TEXT, salio TEXT,
      periodo TEXT NOT NULL DEFAULT '', jefatura TEXT, identificado INTEGER NOT NULL DEFAULT 0,
      motivo TEXT NOT NULL DEFAULT '', entrada_real TEXT NOT NULL DEFAULT '',
      salida_real TEXT NOT NULL DEFAULT '', obs TEXT NOT NULL DEFAULT '',
      respaldo TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_inc_jefatura ON inconsistencias(jefatura);
    CREATE INDEX IF NOT EXISTS idx_inc_rut ON inconsistencias(rut);

    CREATE TABLE IF NOT EXISTS archivos_generados (
      id SERIAL PRIMARY KEY, archivo TEXT NOT NULL, jefatura TEXT NOT NULL,
      filas INTEGER NOT NULL, fecha TEXT NOT NULL, alcance TEXT NOT NULL DEFAULT '', contenido BYTEA
    );
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);

  const dotacionRaw = readGlobalArray(path.join(PROJECT_DIR, 'dotacion.js'), 'DOTACION');
  const inconsistenciasRaw = readGlobalArray(path.join(PROJECT_DIR, 'data-inconsistencias.js'), 'INCONSISTENCIAS');
  const PERIODO = 'julio 2026';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM dotacion');
    await client.query('DELETE FROM inconsistencias');
    await client.query('DELETE FROM archivos_generados');

    for (const d of dotacionRaw) {
      if (!d.rut || !d.nombre) continue;
      await client.query(
        'INSERT INTO dotacion (rut, nombre, area, cargo, estamento, correo, jefatura) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [normRut(d.rut), d.nombre, d.area || '', d.cargo || '', d.estamento || '', d.correo || '', d.jefatura || '']
      );
    }

    const dotByRut = new Map();
    for (const d of dotacionRaw) {
      if (d.rut) dotByRut.set(normRut(d.rut), d);
    }

    for (const r of inconsistenciasRaw) {
      const rut = normRut(r.rut);
      const d = dotByRut.get(rut);
      const jefatura = d ? (d.jefatura && d.jefatura !== '-' ? d.jefatura : '') : null;
      await client.query(
        `INSERT INTO inconsistencias
          (id, rut, rut_fmt, nombre, unidad, fecha, turno, tipo, entro, salio, periodo, jefatura, identificado, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          r.id,
          rut,
          r.rutFmt || r.rut || '',
          r.nombre || (d ? d.nombre : titulo(r.nombre || '')),
          d ? d.area : r.unidad || '',
          r.fecha,
          r.turno || 'No Planificado',
          r.tipo,
          r.entro ?? null,
          r.salio ?? null,
          PERIODO,
          jefatura,
          d ? 1 : 0,
          new Date().toISOString(),
        ]
      );
    }

    const cfg = async (k, v) =>
      client.query('INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
    await cfg('periodo', PERIODO);
    await cfg('plazoTexto', 'Viernes 14 de agosto');
    await cfg('correosAdmin', 'gestiondepersonas@slepaconcagua.gob.cl');
    await cfg('rutaRepositorio', String.raw`\\slepaconcagua\GestionDePersonas\Asistencia\2026\Regularizaciones`);
    await cfg('horaSoloOlvido', 'false');
    await cfg('cascada', 'false');
    await cfg('segundaInstancia', 'true');
    await cfg('mostrarTurno', 'true');
    await cfg('origen', 'Prueba asistencias.xlsx');

    await client.query('INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [
      'inc_seq',
      String(inconsistenciasRaw.length),
    ]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  console.log(
    `Semilla cargada: ${dotacionRaw.filter((d) => d.rut && d.nombre).length} funcionarios en dotación, ${inconsistenciasRaw.length} inconsistencias (periodo ${PERIODO}).`
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

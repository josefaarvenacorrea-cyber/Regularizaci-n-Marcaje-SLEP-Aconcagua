import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig, loadDotacion } from './casos';
import { key as normKey } from './reglas';

const COOKIE_NAME = 'regmarcajes_session';
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

// En producción (Vercel u otro entorno serverless) cada invocación puede
// caer en una instancia distinta sin disco compartido, así que el secreto
// tiene que venir de una variable de entorno fija. El archivo local solo es
// para que `npm run dev` funcione sin configuración extra.
function getSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.VERCEL) {
    throw new Error('Falta la variable de entorno SESSION_SECRET (defínela en la configuración del proyecto en Vercel).');
  }
  const p = path.join(process.cwd(), '.data', 'session.secret');
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(p, secret, { mode: 0o600 });
    return secret;
  }
}

export type Session = { correo: string; rol: 'admin' | 'jefatura'; nombre: string; iat: number };

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function encodeSession(s: Session): string {
  const payload = Buffer.from(JSON.stringify(s)).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function decodeSession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session;
    if (Date.now() / 1000 - s.iat > MAX_AGE_SECONDS) return null;
    return s;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(s: Session) {
  const store = await cookies();
  store.set(COOKIE_NAME, encodeSession(s), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

async function adminCorreos(): Promise<string[]> {
  const cfg = await getConfig();
  const raw = cfg.correosAdmin ?? 'administracion.personas@slepaconcagua.gob.cl';
  return raw.split(',').map((c) => c.trim().toLowerCase());
}

export async function resolveLogin(correoRaw: string): Promise<{ session: Session } | { error: string }> {
  const c = normKey(correoRaw);
  if (!c) return { error: 'Ingrese su correo institucional.' };

  // La comparación se hace en JS (no con LOWER() en SQL) porque `key()`
  // también quita acentos — muy frecuente en nombres chilenos (Martínez,
  // Jiménez, etc.) — y un LOWER() de SQL por sí solo no los normaliza igual,
  // lo que dejaría a esas jefaturas sin poder entrar nunca.
  const dot = await loadDotacion();
  const ficha = dot.find((d) => normKey(d.correo) === c);

  const admins = await adminCorreos();
  if (admins.includes(c)) {
    return {
      session: {
        correo: correoRaw,
        rol: 'admin',
        nombre: ficha ? ficha.nombre : 'Gestión de Personas',
        iat: Math.floor(Date.now() / 1000),
      },
    };
  }
  if (!ficha) return { error: 'Ese correo no está en la dotación efectiva vigente.' };

  const esJefatura = dot.some((d) => normKey(d.jefatura) === normKey(ficha.nombre));
  if (!esJefatura) {
    return { error: 'Su correo no tiene funcionarios a cargo en la dotación, por lo que no hay casos que justificar.' };
  }
  return {
    session: { correo: correoRaw, rol: 'jefatura', nombre: ficha.nombre, iat: Math.floor(Date.now() / 1000) },
  };
}

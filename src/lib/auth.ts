import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getClaveCustom, getConfig, getLoginIntentos, limpiarIntentosLogin, loadDotacion, registrarIntentoFallido, setClaveCustom } from './casos';
import { key as normKey, normRut } from './reglas';

const COOKIE_NAME = 'regmarcajes_session';
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

// Contraseña corta (4 dígitos) a propósito, para que cualquier funcionario
// la recuerde sin tener que gestionar una clave nueva: son los primeros 4
// dígitos de su RUT. Por eso el bloqueo tras varios intentos fallidos es
// importante — sin él, esas 10.000 combinaciones se prueban todas en segundos.
// La temporal solo sirve una vez: al entrar con ella, `resolveLogin` marca
// `debeCambiarClave` y el resto de la app queda bloqueado hasta que la
// cambie por una propia (ver `cambiarClavePropia`).
const LOGIN_MAX_INTENTOS = 5;
const LOGIN_BLOQUEO_MIN = 15;
const CLAVE_MIN_LARGO = 4;

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

export type Session = {
  correo: string;
  rol: 'admin' | 'jefatura' | 'funcionario';
  nombre: string;
  rut: string;
  iat: number;
  // true solo mientras la persona sigue usando la contraseña temporal (los
  // primeros 4 dígitos de su RUT): el resto de la app queda bloqueado detrás
  // de la pantalla de cambio de contraseña hasta que elija una propia. La
  // cuenta de administrador nunca la tiene en true (su contraseña es fija,
  // definida en ADMIN_PASSWORD, no basada en un RUT).
  debeCambiarClave: boolean;
};

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

// Hash con clave (HMAC, no un hash plano) para no guardar la contraseña
// elegida en texto plano en la base — reutiliza el mismo secreto que ya
// firma la cookie de sesión en vez de agregar otro más para gestionar.
function hashClave(clave: string): string {
  return crypto.createHmac('sha256', getSecret()).update(clave).digest('hex');
}

function clavesCoinciden(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
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

// Primeros 4 dígitos del RUT (sin puntos ni guion) — la contraseña de
// jefaturas y funcionarios. Si el RUT en la dotación viene incompleto o
// vacío, devuelve '' y esa cuenta directamente no va a poder entrar hasta
// que se corrija el dato (no hay una clave "por defecto" insegura).
function claveEsperadaDeRut(rut: string): string {
  const digitos = normRut(rut).slice(0, 4);
  return digitos.length === 4 ? digitos : '';
}

export async function resolveLogin(correoRaw: string, claveRaw: string): Promise<{ session: Session } | { error: string }> {
  const c = normKey(correoRaw);
  if (!c) return { error: 'Ingrese su correo institucional.' };
  const clave = String(claveRaw || '').trim();
  if (!clave) return { error: 'Ingrese su contraseña.' };

  const intentos = await getLoginIntentos(c);
  if (intentos.bloqueadoHasta && intentos.bloqueadoHasta > new Date().toISOString()) {
    const minutos = Math.max(1, Math.ceil((new Date(intentos.bloqueadoHasta).getTime() - Date.now()) / 60000));
    return { error: `Demasiados intentos fallidos. Intente de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.` };
  }

  // La comparación se hace en JS (no con LOWER() en SQL) porque `key()`
  // también quita acentos — muy frecuente en nombres chilenos (Martínez,
  // Jiménez, etc.) — y un LOWER() de SQL por sí solo no los normaliza igual,
  // lo que dejaría a esas jefaturas sin poder entrar nunca.
  const dot = await loadDotacion();
  const ficha = dot.find((d) => normKey(d.correo) === c);

  const admins = await adminCorreos();
  if (admins.includes(c)) {
    const claveAdmin = process.env.ADMIN_PASSWORD;
    if (!claveAdmin) {
      return { error: 'La cuenta de administrador no tiene contraseña configurada (falta la variable de entorno ADMIN_PASSWORD).' };
    }
    if (clave !== claveAdmin) {
      await registrarIntentoFallido(c, LOGIN_MAX_INTENTOS, LOGIN_BLOQUEO_MIN);
      return { error: 'Contraseña incorrecta.' };
    }
    await limpiarIntentosLogin(c);
    return {
      session: {
        correo: correoRaw,
        rol: 'admin',
        nombre: ficha ? ficha.nombre : 'Gestión de Personas',
        rut: ficha?.rut ?? '',
        iat: Math.floor(Date.now() / 1000),
        debeCambiarClave: false,
      },
    };
  }
  if (!ficha) return { error: 'Ese correo no está en la dotación efectiva vigente.' };

  // Una vez que la persona elige su propia contraseña, la temporal (RUT) deja
  // de servir — si no, "cambiarla" no cambiaría nada real.
  const claveCustom = await getClaveCustom(c);
  let debeCambiarClave = false;
  if (claveCustom) {
    if (!clavesCoinciden(hashClave(clave), claveCustom)) {
      await registrarIntentoFallido(c, LOGIN_MAX_INTENTOS, LOGIN_BLOQUEO_MIN);
      return { error: 'Contraseña incorrecta.' };
    }
  } else {
    const claveEsperada = claveEsperadaDeRut(ficha.rut);
    if (!claveEsperada || clave !== claveEsperada) {
      await registrarIntentoFallido(c, LOGIN_MAX_INTENTOS, LOGIN_BLOQUEO_MIN);
      return { error: 'Contraseña incorrecta.' };
    }
    debeCambiarClave = true;
  }
  await limpiarIntentosLogin(c);

  const esJefatura = dot.some((d) => normKey(d.jefatura) === normKey(ficha.nombre));
  if (esJefatura) {
    return {
      session: { correo: correoRaw, rol: 'jefatura', nombre: ficha.nombre, rut: ficha.rut, iat: Math.floor(Date.now() / 1000), debeCambiarClave },
    };
  }
  // No tiene gente a cargo: entra en modo funcionario, de solo lectura, a ver
  // sus propias inconsistencias (nunca puede editar nada — eso sigue siendo
  // exclusivo de su jefatura).
  return {
    session: { correo: correoRaw, rol: 'funcionario', nombre: ficha.nombre, rut: ficha.rut, iat: Math.floor(Date.now() / 1000), debeCambiarClave },
  };
}

// Reemplaza la contraseña temporal (o la anterior) por una elegida por la
// propia persona, y devuelve una sesión nueva con `debeCambiarClave: false`
// para que la ruta la vuelva a firmar en la cookie — la sesión vieja quedó
// marcada como pendiente de cambio y no sirve para desbloquear el resto de
// la app.
export async function cambiarClavePropia(session: Session, claveNuevaRaw: string): Promise<{ session: Session } | { error: string }> {
  if (session.rol === 'admin') {
    return { error: 'La cuenta de administrador no cambia su contraseña por acá.' };
  }
  const claveNueva = String(claveNuevaRaw || '').trim();
  if (claveNueva.length < CLAVE_MIN_LARGO) {
    return { error: `La contraseña debe tener al menos ${CLAVE_MIN_LARGO} caracteres.` };
  }
  const c = normKey(session.correo);
  await setClaveCustom(c, hashClave(claveNueva));
  return { session: { ...session, debeCambiarClave: false } };
}

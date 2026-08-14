# Regularización de Marcajes

Implementación real (Next.js + Postgres) del prototipo `Regularización de Marcajes.dc.html`
del bundle de Claude Design en `../project`. Ver `../README.md` y `../chats/chat1.md`
para el contexto de diseño original.

## Arquitectura

- **Next.js (App Router, TypeScript)** — UI en `src/components`, rutas de API en `src/app/api`.
- **Postgres** (paquete `pg`, sin ORM) — dotación, inconsistencias, y los archivos Excel
  generados (guardados como `BYTEA`, no solo su registro). Pensado para desplegarse en
  Vercel: ahí las funciones no tienen disco persistente, así que una base de datos como SQLite
  en un archivo local no sirve — cada invocación puede caer en una instancia distinta.
  El control de acceso (una jefatura solo ve sus propios casos, la base cruda solo la ve
  administración) se aplica en el servidor, no en el navegador.
- **Sesión**: cookie httpOnly firmada (HMAC) con `SESSION_SECRET` como variable de entorno fija
  (no un archivo local — por la misma razón que Postgres: en serverless no hay disco compartido
  entre invocaciones). El login sigue siendo por correo institucional buscado en la dotación, tal
  como se pidió en el chat de diseño, pero el alcance de los datos se resuelve server-side en
  cada request.
- **Excel**: se genera en el servidor con `exceljs` (no `xlsx`/SheetJS, que tiene CVEs sin parchear
  en npm) con las mismas 9 columnas pedidas. Cada exportación queda alojada en la base de datos,
  así que se puede volver a descargar después desde "Excel y repositorio" → registro de archivos.

## Primer uso

```bash
npm install
cp .env.example .env.local   # define POSTGRES_URL y SESSION_SECRET (ver más abajo)
npm run seed                 # carga project/dotacion.js y project/data-inconsistencias.js como datos demo
npm run dev
```

Abre http://localhost:3000 — la pantalla de login lista "Accesos de prueba" (jefaturas demo +
la cuenta de Gestión de Personas) para entrar sin necesitar credenciales reales.

`npm run seed` es destructivo: reemplaza toda la dotación y toda la base de inconsistencias por
los datos de muestra. Solo se necesita una vez (o para volver al estado demo) — para cargar datos
reales, use las pantallas de administración ("Cargar base"), no este script.

### Variables de entorno

- `POSTGRES_URL` (o `DATABASE_URL`) — cadena de conexión a Postgres. En local, cualquier Postgres
  sirve (`postgres://usuario:clave@localhost:5432/basededatos`); en Vercel, se agrega sola al
  conectar el storage de Postgres desde el panel del proyecto.
- `SESSION_SECRET` — string aleatorio largo (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  para firmar la cookie de sesión. En local, si se omite, se genera y guarda uno en
  `.data/session.secret` automáticamente; en Vercel es obligatorio definirlo a mano (una sola vez,
  igual en todas las instancias).

## Estructura

- `src/lib/reglas.ts` — catálogo de motivos por tipo de inconsistencia y reglas de completitud
  (incluye qué motivos requieren hora real, observación obligatoria, o una marca de entrada
  real como en "Permiso Gremial" para atrasos); puerto directo de la lógica del prototipo, usado
  tanto en el servidor (validación autoritativa) como en el cliente (estado derivado).
- `src/lib/db.ts` — pool de Postgres, helpers `query`/`queryOne`/`execute`/`withTransaction`.
- `src/lib/casos.ts` — acceso a datos de dotación/inconsistencias, incluida la carga incremental
  de inconsistencias (`actualizarBase`, upsert por funcionario+fecha+tipo, nunca borra) y el
  reemplazo de dotación (`reemplazarDotacion`, que recalcula la jefatura de cada inconsistencia
  ya cargada contra la dotación nueva).
- `src/lib/auth.ts`, `src/lib/parseUpload.ts`, `src/lib/exportXlsx.ts` — sesión, parseo de las
  cargas (reloj control y dotación), generación del Excel.
- `src/app/api/**` — endpoints REST consumidos por la UI.
- `src/components/**` — pantallas (login, bandeja, revisión rápida, cierre y Excel, panel de
  administración, carga de dotación/inconsistencias, historial).

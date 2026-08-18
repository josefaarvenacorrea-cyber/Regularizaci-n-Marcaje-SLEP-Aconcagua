'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtFecha } from '@/lib/reglas';

type Archivo = { id: number; nombreArchivo: string; tamano: number; creadoEn: string };
type CasoGrupo = { casoId: string; fecha: string; tipo: string; motivo: string; archivos: Archivo[] };
type PersonaGrupo = { rut: string; nombre: string; casos: CasoGrupo[] };

function tamanoFmt(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function RespaldosAdmin() {
  const [personas, setPersonas] = useState<PersonaGrupo[] | null>(null);
  const [buscar, setBuscar] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ personas: PersonaGrupo[] }>('/api/admin/respaldos')
      .then((r) => setPersonas(r.personas))
      .catch(() => setError('No se pudo cargar el listado de archivos.'));
  }, []);

  const q = buscar.trim().toLowerCase();
  const visibles = useMemo(() => {
    if (!personas) return [];
    if (!q) return personas;
    return personas.filter((p) => (p.nombre + ' ' + p.rut).toLowerCase().includes(q));
  }, [personas, q]);

  const totalArchivos = useMemo(
    () => (personas || []).reduce((n, p) => n + p.casos.reduce((m, c) => m + c.archivos.length, 0), 0),
    [personas]
  );

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 32px 90px' }}>
      <h1 style={{ fontSize: 34, margin: '0 0 4px' }}>Respaldos adjuntos</h1>
      <p className="text-muted" style={{ fontSize: 13, margin: '0 0 22px' }}>
        Todos los documentos que las jefaturas adjuntaron al justificar un caso, organizados por persona y por caso —
        {personas ? ' ' + totalArchivos + (totalArchivos === 1 ? ' archivo en total.' : ' archivos en total.') : ''}
      </p>

      <div className="field" style={{ width: 280, marginBottom: 18 }}>
        <label>Buscar funcionario</label>
        <input className="input" type="text" placeholder="Nombre o RUT" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>

      {error && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{error}</div>}
      {!error && personas === null && <div className="text-muted" style={{ fontSize: 13 }}>Cargando…</div>}
      {!error && personas && personas.length === 0 && (
        <div className="text-muted" style={{ fontSize: 13 }}>Todavía no se ha adjuntado ningún archivo.</div>
      )}
      {!error && personas && personas.length > 0 && visibles.length === 0 && (
        <div className="text-muted" style={{ fontSize: 13 }}>Ningún funcionario coincide con la búsqueda.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibles.map((p) => (
          <details key={p.rut} className="blueprint" style={{ padding: '12px 16px', background: 'var(--color-bg)' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-heading)', fontSize: 16 }}>
              📁 {p.nombre} <span className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>({p.rut} · {p.casos.reduce((n, c) => n + c.archivos.length, 0)} archivos)</span>
            </summary>
            <div style={{ marginTop: 10, paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {p.casos.map((c) => (
                <div key={c.casoId}>
                  <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                    📁 {fmtFecha(c.fecha)} · <span className="text-muted">{c.tipo}{c.motivo ? ' · ' + c.motivo : ''}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 24, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {c.archivos.map((a) => (
                      <li key={a.id}>
                        <a href={`/api/casos/${encodeURIComponent(c.casoId)}/respaldo/${a.id}`} target="_blank" rel="noreferrer">
                          📎 {a.nombreArchivo}
                        </a>{' '}
                        <span className="text-muted">({tamanoFmt(a.tamano)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}

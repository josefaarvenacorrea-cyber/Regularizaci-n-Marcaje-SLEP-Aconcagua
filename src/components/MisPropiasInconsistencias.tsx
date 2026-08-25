'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Caso } from '@/lib/casos';
import { casoDisplay } from '@/lib/display';

// Una jefatura también marca en el reloj control y también tiene su propia
// jefatura arriba — esta pestaña le muestra sus propias inconsistencias, de
// solo lectura (nunca las edita ella misma: eso es exclusivo de su propia
// jefatura, igual que para cualquier funcionario).
export function MisPropiasInconsistencias() {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ casos: Caso[] }>('/api/casos/propias')
      .then((r) => setCasos(r.casos))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudieron cargar sus inconsistencias.'));
  }, []);

  const displays = (casos || []).map((c) => ({ c, d: casoDisplay(c, false, false) }));
  const pendientes = displays.filter((x) => !x.d.confirmada).length;

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 32px 90px' }}>
      <h1 style={{ fontSize: 30, margin: '0 0 8px' }}>Sus propias inconsistencias de marcaje</h1>
      <p className="text-muted" style={{ fontSize: 13.5, maxWidth: '68ch', margin: '0 0 24px' }}>
        Esto es solo informativo: usted no puede editar nada acá. Si tiene una inconsistencia pendiente, envíe la
        información indicada en <strong>Acción solicitada</strong> a su propia jefatura por conducto interno — es ella
        quien la regulariza en el sistema.
      </p>

      {error && (
        <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-accent-700)', background: 'var(--color-accent-100)' }}>{error}</div>
      )}
      {!error && casos === null && <div className="text-muted" style={{ fontSize: 13 }}>Cargando…</div>}
      {!error && casos !== null && casos.length === 0 && (
        <div className="text-muted" style={{ fontSize: 13 }}>No tiene inconsistencias de marcaje registradas en este período.</div>
      )}

      {!error && casos !== null && casos.length > 0 && (
        <>
          <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
            {pendientes ? pendientes + (pendientes === 1 ? ' inconsistencia pendiente.' : ' inconsistencias pendientes.') : 'Todas están regularizadas.'}
          </p>
          <div className="blueprint" style={{ background: 'var(--color-bg)', overflowX: 'auto' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <table className="table" style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '9px 10px', width: 90 }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', width: 140 }}>Inconsistencia</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', width: 110 }}>Estado</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px' }}>Acción solicitada</th>
                </tr>
              </thead>
              <tbody>
                {displays.map(({ c, d }) => (
                  <tr key={c.id}>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' }}>
                      {d.fechaFmt}<div className="text-muted" style={{ fontSize: 11 }}>{d.diaSem}</div>
                    </td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top' }}><span className={`tag ${d.tagClass}`}>{d.tipo}</span></td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top' }}><span className={`tag ${d.estadoClass}`}>{d.estadoLabel}</span></td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>{d.accionSolicitada}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

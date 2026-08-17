'use client';

import { useMemo, useState } from 'react';
import type { Caso } from '@/lib/casos';
import { casoDisplay } from '@/lib/display';

export function Bandeja({
  casos,
  horaSoloOlvido,
  esAdmin,
  mostrarTurno,
  onUpdate,
  onHistorial,
  irEnvio,
  irRapida,
}: {
  casos: Caso[];
  horaSoloOlvido: boolean;
  esAdmin: boolean;
  mostrarTurno: boolean;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onHistorial: (rut: string) => void;
  irEnvio: () => void;
  irRapida: () => void;
}) {
  const [buscar, setBuscar] = useState('');
  const [filtroFunc, setFiltroFunc] = useState('Todos');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [soloPend, setSoloPend] = useState(false);
  const [verEnviados, setVerEnviados] = useState(false);
  const [obsDraft, setObsDraft] = useState<Record<string, string>>({});

  const total = casos.length;
  const displays = useMemo(() => casos.map((c) => ({ c, d: casoDisplay(c, horaSoloOlvido, esAdmin) })), [casos, horaSoloOlvido, esAdmin]);
  const enviados = displays.filter((x) => x.d.confirmada).length;
  const resueltas = displays.filter((x) => x.d.completa).length;
  const pendientes = total - resueltas;

  const tipos = [...new Set(casos.map((c) => c.tipo))];
  const personas = [...new Map(casos.map((c) => [c.rut, c.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const q = buscar.trim().toLowerCase();
  const visibles = displays.filter(({ c, d }) => {
    if (!verEnviados && d.confirmada) return false;
    if (filtroTipo !== 'Todos' && c.tipo !== filtroTipo) return false;
    if (filtroFunc !== 'Todos' && c.rut !== filtroFunc) return false;
    if (soloPend && d.completa) return false;
    if (q && !(c.nombre + ' ' + c.rut).toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <main style={{ padding: '24px 32px 90px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14, marginBottom: 16 }}>
        <div className="field" style={{ width: 230 }}>
          <label>Buscar funcionario</label>
          <input className="input" type="text" placeholder="Apellido, nombre o RUT" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <div className="field" style={{ width: 230 }}>
          <label>Funcionario</label>
          <select className="input" value={filtroFunc} onChange={(e) => setFiltroFunc(e.target.value)}>
            <option value="Todos">Todos ({personas.length})</option>
            {personas.map(([rut, nom]) => (
              <option key={rut} value={rut}>{nom}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span className="text-muted" style={{ fontSize: 12 }}>Tipo de inconsistencia</span>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {['Todos', ...tipos].map((t) => (
              <button
                key={t}
                type="button"
                className={`btn ${filtroTipo === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFiltroTipo(t)}
                style={{ borderRadius: 0, fontSize: 13 }}
              >
                {t} <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, opacity: 0.7 }}>{t === 'Todos' ? total : casos.filter((c) => c.tipo === t).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-secondary" onClick={() => setVerEnviados(!verEnviados)}>
          {verEnviados ? 'Ocultar enviados' : 'Ver enviados (' + enviados + ')'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setSoloPend(!soloPend)}>{soloPend ? 'Ver todas' : 'Ver solo pendientes'}</button>
      </div>

      <div className="blueprint" style={{ background: 'var(--color-bg)', overflowX: 'auto' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <table className="table" style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 210 }}>Funcionario</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 86 }}>Fecha</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 128 }}>Inconsistencia</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 132 }}>Marcas del reloj</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 262 }}>Motivo de justificación</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 168 }}>Hora real justificada</th>
              <th style={{ textAlign: 'left', padding: '9px 10px' }}>Observación</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 104 }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(({ c, d }) => (
              <tr key={c.id}>
                <td style={{ padding: '7px 10px', verticalAlign: 'top' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => onHistorial(c.rut)} style={{ padding: 0, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, textAlign: 'left' }}>{d.nombre}</button>
                  <div className="text-muted" style={{ fontSize: 11 }}>{d.rut}{mostrarTurno && <span> · {d.turno}</span>}</div>
                  {d.contexto && <div style={{ fontSize: 11, color: 'var(--color-accent-700)' }}>{d.contexto}</div>}
                </td>
                <td style={{ padding: '7px 10px', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' }}>{d.fechaFmt}<div className="text-muted" style={{ fontSize: 11 }}>{d.diaSem}</div></td>
                <td style={{ padding: '7px 10px', verticalAlign: 'top' }}><span className={`tag ${d.tagClass}`}>{d.tipo}</span></td>
                <td style={{ padding: '7px 10px', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <div>Entrada <strong>{d.marcaEntrada}</strong></div>
                  <div>Salida <strong>{d.marcaSalida}</strong></div>
                </td>
                <td style={{ padding: '7px 10px', verticalAlign: 'top' }}>
                  <select
                    className="input"
                    style={{ fontSize: 13, minHeight: 32 }}
                    value={d.motivo}
                    disabled={d.confirmada}
                    onChange={(e) => onUpdate(c.id, { motivo: e.target.value })}
                  >
                    {d.motivos.map((m) => (
                      <option key={m.v} value={m.v}>{m.label}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '7px 10px', verticalAlign: 'top' }}>
                  {d.horaHabilitada ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {d.pideEntrada && (
                        <label style={{ flex: 1, fontSize: 10 }} className="text-muted">
                          Entrada
                          <input className="input" type="time" disabled={d.confirmada} style={{ minHeight: 32, fontSize: 13, borderColor: d.bordeEntrada ? 'var(--color-accent)' : 'var(--color-divider)' }} value={d.entradaReal} onChange={(e) => onUpdate(c.id, { entradaReal: e.target.value })} />
                        </label>
                      )}
                      {d.pideSalida && (
                        <label style={{ flex: 1, fontSize: 10 }} className="text-muted">
                          Salida
                          <input className="input" type="time" disabled={d.confirmada} style={{ minHeight: 32, fontSize: 13, borderColor: d.bordeSalida ? 'var(--color-accent)' : 'var(--color-divider)' }} value={d.salidaReal} onChange={(e) => onUpdate(c.id, { salidaReal: e.target.value })} />
                        </label>
                      )}
                    </div>
                  ) : (
                    d.horaBloqueada && <span className="text-muted" style={{ fontSize: 11 }}>No aplica a este motivo</span>
                  )}
                </td>
                <td style={{ padding: '7px 10px', verticalAlign: 'top' }}>
                  <input
                    className="input"
                    type="text"
                    disabled={d.confirmada}
                    style={{ minHeight: 32, fontSize: 13, borderColor: d.bordeObs ? 'var(--color-accent)' : 'var(--color-divider)' }}
                    placeholder={d.placeholderObs}
                    value={obsDraft[c.id] ?? d.obs}
                    onChange={(e) => setObsDraft((s) => ({ ...s, [c.id]: e.target.value }))}
                    onBlur={(e) => onUpdate(c.id, { obs: e.target.value })}
                  />
                  <button type="button" className="btn btn-ghost" disabled={d.confirmada} onClick={() => onUpdate(c.id, { toggleRespaldo: true })} style={{ fontSize: 11, fontFamily: 'var(--font-body)', marginTop: 3 }}>{d.labelRespaldo}</button>
                </td>
                <td style={{ padding: '7px 10px', verticalAlign: 'top' }}>
                  <span className={`tag ${d.estadoClass}`}>{d.estadoLabel}</span>
                  {d.listaParaEnviar && (
                    <div><button type="button" className="btn btn-primary" onClick={() => onUpdate(c.id, { confirmar: true })} style={{ fontSize: 11, padding: '4px 10px', marginTop: 4 }}>Enviar</button></div>
                  )}
                  {d.completa && (
                    <div><button type="button" className="btn btn-ghost" onClick={() => onUpdate(c.id, { limpiar: true })} style={{ fontSize: 11, fontFamily: 'var(--font-body)', marginTop: 2 }}>Deshacer</button></div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibles.length === 0 && (
          <div className="text-muted" style={{ padding: 40, textAlign: 'center', fontSize: 13 }}>
            {total === 0 ? 'No hay inconsistencias de marcaje asignadas a su equipo en este período.' : 'No hay inconsistencias con estos filtros.'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
        <button type="button" className="btn btn-primary blueprint" onClick={irEnvio} style={{ padding: '10px 20px' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          Revisar y exportar
        </button>
        <button type="button" className="btn btn-secondary" onClick={irRapida}>Revisión rápida de pendientes</button>
        <span className="text-muted" style={{ fontSize: 12 }}>{pendientes ? pendientes + ' inconsistencias siguen sin motivo asignado.' : 'Todos los casos visibles están justificados.'}</span>
      </div>
    </main>
  );
}

'use client';

import { useMemo, useState } from 'react';
import type { Caso } from '@/lib/casos';
import { casoDisplay } from '@/lib/display';
import { completa as calcCompleta, motivosDe } from '@/lib/reglas';

function vecinoPendiente(casos: Caso[], id: string | null, paso: number, esCompleta: (c: Caso) => boolean): string | null {
  const i = id ? casos.findIndex((c) => c.id === id) : -1;
  if (i < 0) {
    const p = casos.find((c) => !esCompleta(c));
    return p ? p.id : null;
  }
  for (let k = 1; k <= casos.length; k++) {
    const j = (i + paso * k + casos.length * 2) % casos.length;
    if (!esCompleta(casos[j])) return casos[j].id;
  }
  return null;
}

export function RevisionRapida({
  casos,
  horaSoloOlvido,
  cursorId,
  setCursorId,
  onUpdate,
  irEnvio,
}: {
  casos: Caso[];
  horaSoloOlvido: boolean;
  cursorId: string | null;
  setCursorId: (id: string | null) => void;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  irEnvio: () => void;
}) {
  const [obsDraft, setObsDraft] = useState<Record<string, string>>({});
  const esCompleta = (c: Caso) => calcCompleta({ tipo: c.tipo, motivo: c.motivo, entradaReal: c.entradaReal, salidaReal: c.salidaReal, obs: c.obs, entro: c.entro, salio: c.salio }, horaSoloOlvido);
  const pend = useMemo(() => casos.filter((c) => !esCompleta(c)), [casos, horaSoloOlvido]); // eslint-disable-line react-hooks/exhaustive-deps
  const actual = (cursorId ? casos.find((c) => c.id === cursorId) : null) || pend[0];
  const posPend = actual ? pend.findIndex((c) => c.id === actual.id) : -1;

  const ir = (paso: number) => actual && setCursorId(vecinoPendiente(casos, actual.id, paso, esCompleta));

  if (!actual) {
    return (
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 32px 90px' }}>
        <div className="blueprint" style={{ padding: '56px 28px', textAlign: 'center', background: 'var(--color-neutral-100)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h2 style={{ margin: '0 0 6px' }}>No quedan pendientes</h2>
          <p className="text-muted" style={{ fontSize: 14, margin: '0 0 18px' }}>Todas las inconsistencias de su equipo tienen motivo asignado.</p>
          <button type="button" className="btn btn-primary" onClick={irEnvio}>Revisar y exportar</button>
        </div>
      </main>
    );
  }

  const d = casoDisplay(actual, horaSoloOlvido, false);
  const rapidaPos = posPend >= 0 ? posPend + 1 + ' de ' + pend.length + ' pendientes' : 'caso justificado · quedan ' + pend.length + ' pendientes';
  const obsValue = obsDraft[actual.id] ?? d.obs;

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 32px 90px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h6 className="text-muted" style={{ margin: 0 }}>Revisión rápida · {rapidaPos}</h6>
      </div>

      <div className="blueprint" style={{ padding: '26px 28px', background: 'var(--color-neutral-100)', animation: 'dcIn .18s ease-out' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 2px' }}>{d.nombre}</h2>
            <div className="text-muted" style={{ fontSize: 12 }}>{d.rut} · {d.cargo}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`tag ${d.tagClass}`}>{d.tipo}</span>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginTop: 6 }}>{d.fechaLarga}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 36, margin: '22px 0', borderTop: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)', padding: '14px 0', fontVariantNumeric: 'tabular-nums' }}>
          <div><div className="text-muted" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>Entrada registrada</div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 26 }}>{d.marcaEntrada}</div></div>
          <div><div className="text-muted" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>Salida registrada</div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 26 }}>{d.marcaSalida}</div></div>
          <div><div className="text-muted" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>Turno</div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 26 }}>{d.turnoHora}</div></div>
        </div>

        <div className="text-muted" style={{ fontSize: 12, marginBottom: 7 }}>Motivos permitidos para {d.tipo}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {motivosDe(d.tipo).map((m) => (
            <button
              key={m.v}
              type="button"
              className={`btn ${d.motivo === m.v ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onUpdate(actual.id, { motivo: m.v })}
              style={{ borderRadius: 0, justifyContent: 'flex-start', textAlign: 'left', padding: '9px 12px' }}
            >
              {m.v}
            </button>
          ))}
        </div>

        {d.horaHabilitada && (
          <div style={{ marginTop: 20, padding: 16, border: '1px solid var(--color-accent-400)', background: 'var(--color-accent-100)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, marginBottom: 2 }}>{d.tituloHora}</div>
            <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>Solo puede registrar la hora real de la marca faltante. El resto de la jornada no se modifica.</div>
            <div style={{ display: 'flex', gap: 12, maxWidth: 340 }}>
              {d.pideEntrada && (
                <div className="field" style={{ flex: 1 }}>
                  <label>Hora real de entrada</label>
                  <input className="input" type="time" value={d.entradaReal} onChange={(e) => onUpdate(actual.id, { entradaReal: e.target.value })} />
                </div>
              )}
              {d.pideSalida && (
                <div className="field" style={{ flex: 1 }}>
                  <label>Hora real de salida</label>
                  <input className="input" type="time" value={d.salidaReal} onChange={(e) => onUpdate(actual.id, { salidaReal: e.target.value })} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="field" style={{ marginTop: 18 }}>
          <label>{d.labelObs}</label>
          <input
            className="input"
            type="text"
            placeholder={d.placeholderObs}
            value={obsValue}
            onChange={(e) => setObsDraft((s) => ({ ...s, [actual.id]: e.target.value }))}
            onBlur={(e) => onUpdate(actual.id, { obs: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={() => ir(-1)}>Anterior</button>
          <button type="button" className="btn btn-primary" disabled={!d.completa} onClick={() => ir(1)}>Guardar y siguiente</button>
          <button type="button" className="btn btn-ghost" onClick={() => ir(1)}>Saltar por ahora</button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={() => onUpdate(actual.id, { toggleRespaldo: true })}>{d.labelRespaldo}</button>
        </div>
        {d.completa && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-accent-700)' }}>
            Caso guardado como <strong>{d.estadoLabel}</strong>. Avance con «Guardar y siguiente» cuando quiera pasar al próximo pendiente.
          </div>
        )}
        {!d.completa && d.aviso && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-accent-700)' }}>{d.aviso}</div>}
      </div>
    </main>
  );
}

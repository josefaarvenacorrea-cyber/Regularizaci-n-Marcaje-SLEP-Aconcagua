'use client';

import { useState } from 'react';

export type JefaturaResumen = {
  nombre: string;
  correo: string;
  area: string;
  cargo: string;
  equipo: number;
  casos: number;
  resueltos: number;
  pct: number;
};

export function PanelAvance({
  periodo,
  jefaturas,
  casosSinJefatura,
  casosNoIdentificados,
  jefaturasPendientes,
  plazoTexto,
  cascada,
  onVerCasos,
  onVerHuerfanos,
}: {
  periodo: string;
  jefaturas: JefaturaResumen[];
  casosSinJefatura: number;
  casosNoIdentificados: number;
  jefaturasPendientes: number;
  plazoTexto: string;
  cascada: boolean;
  onVerCasos: (nombreJefatura: string) => void;
  onVerHuerfanos: () => void;
}) {
  const [mensajeRecordatorio, setMensajeRecordatorio] = useState('');

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 32px 90px' }}>
      <h1 style={{ fontSize: 32, margin: '0 0 4px' }}>Avance por jefatura · {periodo}</h1>
      <p className="text-muted" style={{ fontSize: 13, margin: '0 0 22px' }}>
        {cascada ? 'Las jefaturas de segundo nivel también ven los equipos que dependen de ellas.' : 'Cada jefatura ve solo a sus dependientes directos según la columna Jefatura de la dotación.'}
      </p>

      <div className="blueprint" style={{ background: 'var(--color-bg)', overflowX: 'auto' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <table className="table" style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '9px 10px' }}>Jefatura</th>
              <th style={{ textAlign: 'left', padding: '9px 10px' }}>Área</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 80 }}>Equipo</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 80 }}>Casos</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 110 }}>Regularizados</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 150 }}>Avance</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {jefaturas.map((j) => (
              <tr key={j.nombre}>
                <td style={{ padding: '8px 10px' }}><div style={{ fontWeight: 500 }}>{j.nombre}</div><div className="text-muted" style={{ fontSize: 11 }}>{j.correo}</div></td>
                <td style={{ padding: '8px 10px', fontSize: 12 }}>{j.area}</td>
                <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{j.equipo}</td>
                <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{j.casos}</td>
                <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{j.resueltos}</td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--color-neutral-300)', border: '1px solid var(--color-divider)' }}>
                      <div style={{ height: '100%', background: 'var(--color-accent)', width: j.pct + '%' }} />
                    </div>
                    <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{j.pct}%</span>
                  </div>
                </td>
                <td style={{ padding: '8px 10px' }}><button type="button" className="btn btn-ghost" onClick={() => onVerCasos(j.nombre)} style={{ fontSize: 12 }}>Ver sus casos</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 26, alignItems: 'start' }}>
        <div className="blueprint" style={{ padding: 20, background: 'var(--color-neutral-100)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h4 style={{ margin: '0 0 6px' }}>Casos sin jefatura responsable</h4>
          <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 12px' }}>{casosSinJefatura} casos de funcionarios cuya columna Jefatura viene vacía y {casosNoIdentificados} de RUT que no figuran en la dotación vigente. Ninguna jefatura los ve.</p>
          <button type="button" className="btn btn-secondary" onClick={onVerHuerfanos}>Revisarlos como Gestión de Personas</button>
        </div>
        <div className="blueprint" style={{ padding: 20, background: 'var(--color-bg)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h4 style={{ margin: '0 0 6px' }}>Recordatorio de plazo</h4>
          <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 12px' }}>{jefaturasPendientes} jefaturas tienen casos sin justificar al {plazoTexto}.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setMensajeRecordatorio('Recordatorio enviado a ' + jefaturasPendientes + ' jefaturas el ' + new Date().toLocaleString('es-CL') + '.')}
          >
            Enviar recordatorio
          </button>
          <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 8 }}>{mensajeRecordatorio}</div>
        </div>
      </div>
    </main>
  );
}

'use client';

import { useMemo } from 'react';
import type { Caso } from '@/lib/casos';
import type { Session } from '@/lib/auth';
import { casoDisplay } from '@/lib/display';
import { COLUMNAS } from '@/lib/reglas';

export type RegistroEntry = { id: number; archivo: string; jefatura: string; filas: number; fecha: string };

export function CierreEnvio({
  session,
  casos,
  horaSoloOlvido,
  esAdmin,
  verHuerfanos,
  periodo,
  plazoTexto,
  rutaRepositorio,
  segundaInstancia,
  firma,
  setFirma,
  onExportar,
  onConsolidado,
  onEnviar,
  enviandoGdp,
  mensajeExcel,
  mensajeEnviado,
  registro,
  onDescargarRegistro,
}: {
  session: Session;
  casos: Caso[];
  horaSoloOlvido: boolean;
  esAdmin: boolean;
  verHuerfanos: boolean;
  periodo: string;
  plazoTexto: string;
  rutaRepositorio: string;
  segundaInstancia: boolean;
  firma: boolean;
  setFirma: (v: boolean) => void;
  onExportar: () => void;
  onConsolidado: () => void;
  onEnviar: () => void;
  enviandoGdp: boolean;
  mensajeExcel: string;
  mensajeEnviado: string;
  registro: RegistroEntry[] | null;
  onDescargarRegistro: (id: number) => void;
}) {
  const displays = useMemo(() => casos.map((c) => ({ c, d: casoDisplay(c, horaSoloOlvido, esAdmin) })), [casos, horaSoloOlvido, esAdmin]);
  const total = casos.length;
  const listos = displays.filter((x) => x.d.confirmada);
  const resueltas = listos.length;
  const pendientes = total - resueltas;
  const personas = new Set(casos.map((c) => c.rut)).size;

  const porMotivoMap = new Map<string, { casos: number; set: Set<string> }>();
  for (const { c } of listos) {
    const e = porMotivoMap.get(c.motivo) || { casos: 0, set: new Set<string>() };
    e.casos++;
    e.set.add(c.nombre);
    porMotivoMap.set(c.motivo, e);
  }
  const porMotivo = [...porMotivoMap.entries()].map(([motivo, e]) => ({
    motivo,
    casos: e.casos,
    personas: [...e.set].slice(0, 3).join(', ') + (e.set.size > 3 ? ' +' + (e.set.size - 3) : ''),
  }));

  const alcanceEnvio = esAdmin ? (verHuerfanos ? 'Casos sin jefatura responsable.' : 'Vista completa del servicio.') : 'Casos de los funcionarios que dependen de usted.';
  const noPuedeExportar = !firma || resueltas === 0;
  const mensajeEnvio = [mensajeExcel, mensajeEnviado].filter(Boolean).join(' · ') || (firma ? (resueltas ? 'Listo para exportar.' : 'Aún no hay filas resueltas.') : 'Firme la declaración para habilitar la exportación.');

  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 32px 90px' }}>
      <h1 style={{ fontSize: 34, margin: '0 0 4px' }}>Cierre y archivo Excel · {periodo}</h1>
      <p className="text-muted" style={{ fontSize: 13, margin: '0 0 22px' }}>{alcanceEnvio}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--color-divider)', border: '1px solid var(--color-divider)', marginBottom: 26 }}>
        {[
          { label: 'Inconsistencias', valor: total },
          { label: 'Regularizadas', valor: resueltas },
          { label: 'Sin resolver', valor: pendientes },
          { label: 'Funcionarios', valor: personas },
        ].map((k) => (
          <div key={k.label} style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
            <div className="text-muted" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1.1 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div className="blueprint" style={{ background: 'var(--color-bg)', marginBottom: 26 }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: '9px 10px' }}>Motivo</th><th style={{ textAlign: 'left', padding: '9px 10px', width: 110 }}>Casos</th><th style={{ textAlign: 'left', padding: '9px 10px' }}>Funcionarios</th></tr></thead>
          <tbody>
            {porMotivo.map((m) => (
              <tr key={m.motivo}><td style={{ padding: '8px 10px' }}>{m.motivo}</td><td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}>{m.casos}</td><td style={{ padding: '8px 10px' }} className="text-muted">{m.personas}</td></tr>
            ))}
          </tbody>
        </table>
        {listos.length === 0 && <div className="text-muted" style={{ padding: 26, textAlign: 'center', fontSize: 13 }}>Todavía no hay inconsistencias regularizadas.</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 26, alignItems: 'start' }}>
        <div className="blueprint" style={{ padding: 22, background: 'var(--color-neutral-100)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h4 style={{ margin: '0 0 10px' }}>{esAdmin ? 'Declaración de Gestión de Personas' : 'Declaración de la jefatura'}</h4>
          <p className="text-muted" style={{ fontSize: 13 }}>Declaro que las justificaciones y las horas consignadas corresponden a la asistencia efectiva de cada funcionario, y que los antecedentes de respaldo están en mi poder.</p>
          <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, marginTop: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={firma} onChange={(e) => setFirma(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--color-accent)' }} />
            <span>Firmo como <strong>{session.nombre}</strong></span>
          </label>
          {pendientes > 0 && (
            <div style={{ marginTop: 14, padding: '10px 12px', border: '1px solid var(--color-accent-400)', background: 'var(--color-accent-100)', fontSize: 12 }}>
              Quedan {pendientes} inconsistencias sin motivo. Puede exportar solo lo resuelto y completar el resto antes del {plazoTexto}.
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn btn-primary" onClick={onExportar} disabled={noPuedeExportar}>Descargar Excel ({resueltas === 1 ? '1 fila' : resueltas + ' filas'})</button>
            {!esAdmin && segundaInstancia && (
              <button type="button" className="btn btn-secondary" onClick={onEnviar} disabled={noPuedeExportar || enviandoGdp}>
                {enviandoGdp ? 'Enviando…' : 'Enviar a Gestión de Personas'}
              </button>
            )}
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>{mensajeEnvio}</div>
        </div>

        <div className="blueprint" style={{ padding: 22, background: 'var(--color-bg)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h4 style={{ margin: '0 0 4px' }}>Dónde queda el archivo</h4>
          <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>
            El Excel se descarga en su equipo y además queda alojado en el sistema: Gestión de
            Personas puede volver a descargarlo desde el registro de abajo cuando lo necesite. Si además
            debe subirlo a la carpeta institucional, esta es la ruta:
          </p>
          <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11.5, padding: '9px 10px', border: '1px solid var(--color-divider)', background: 'var(--color-neutral-100)', wordBreak: 'break-all' }}>{rutaRepositorio}</div>
          <h6 style={{ margin: '16px 0 6px' }}>Columnas</h6>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, lineHeight: 1.75 }}>
            {COLUMNAS.map((c) => <li key={c}>{c}</li>)}
          </ol>
        </div>
      </div>

      {esAdmin && (
        <div className="blueprint" style={{ padding: 22, background: 'var(--color-bg)', marginTop: 26 }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h4 style={{ margin: '0 0 4px' }}>Registro de archivos generados</h4>
              <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>Cada descarga queda alojada aquí — puede volver a bajarla cuando quiera, no depende del equipo que la generó.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={onConsolidado}>Exportar consolidado del servicio</button>
          </div>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 14 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: '8px 10px' }}>Archivo</th><th style={{ textAlign: 'left', padding: '8px 10px', width: 210 }}>Jefatura</th><th style={{ textAlign: 'left', padding: '8px 10px', width: 80 }}>Filas</th><th style={{ textAlign: 'left', padding: '8px 10px', width: 160 }}>Generado</th><th style={{ textAlign: 'left', padding: '8px 10px', width: 90 }}></th></tr></thead>
            <tbody>
              {(registro || []).map((e) => (
                <tr key={e.id}>
                  <td style={{ padding: '7px 10px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11.5 }}>{e.archivo}</td>
                  <td style={{ padding: '7px 10px' }}>{e.jefatura}</td>
                  <td style={{ padding: '7px 10px', fontVariantNumeric: 'tabular-nums' }}>{e.filas}</td>
                  <td style={{ padding: '7px 10px' }} className="text-muted">{e.fecha}</td>
                  <td style={{ padding: '7px 10px' }}><button type="button" className="btn btn-ghost" style={{ fontSize: 11.5 }} onClick={() => onDescargarRegistro(e.id)}>Descargar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!registro || registro.length === 0) && <div className="text-muted" style={{ padding: 20, textAlign: 'center', fontSize: 12.5 }}>Aún no se ha generado ningún archivo en este período.</div>}
        </div>
      )}
    </main>
  );
}

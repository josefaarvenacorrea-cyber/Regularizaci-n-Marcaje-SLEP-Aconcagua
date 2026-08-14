'use client';

import type { Caso } from '@/lib/casos';
import { diaSemana, fmtFecha, tagClass } from '@/lib/reglas';

export function HistorialDrawer({ rut, items, onClose }: { rut: string; items: Caso[]; onClose: () => void }) {
  const primero = items[0];
  const resueltas = items.filter((c) => !!c.completa).length;
  const tipoConteo = new Map<string, number>();
  for (const c of items) tipoConteo.set(c.tipo, (tipoConteo.get(c.tipo) || 0) + 1);
  const frecuente = [...tipoConteo.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div
      className="dialog-backdrop"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb,#1d1f20 45%,transparent)', display: 'flex', justifyContent: 'flex-end', zIndex: 40 }}
    >
      <div className="dialog blueprint" onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', height: '100%', background: 'var(--color-bg)', padding: 26, overflow: 'auto' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h6 className="text-muted" style={{ margin: '0 0 4px' }}>Historial del período</h6>
            <h3 style={{ margin: 0 }}>{primero?.nombre || ''}</h3>
            <div className="text-muted" style={{ fontSize: 12 }}>{rut} · {primero ? (primero.cargo ? primero.cargo + ' · ' : '') + primero.unidad : ''}</div>
          </div>
          <button type="button" className="btn btn-secondary btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 26, margin: '18px 0', borderTop: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)', padding: '12px 0' }}>
          <div><div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>Inconsistencias</div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 24 }}>{items.length}</div></div>
          <div><div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>Resueltas</div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 24 }}>{resueltas}</div></div>
          <div><div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>Reiteración</div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 24 }}>{frecuente ? frecuente[1] + '× ' + frecuente[0] : '—'}</div></div>
        </div>
        {items.map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-divider)', fontSize: 13 }}>
            <div style={{ width: 88, fontVariantNumeric: 'tabular-nums' }}>{diaSemana(c.fecha)} {fmtFecha(c.fecha)}</div>
            <div style={{ width: 118 }}><span className={`tag ${tagClass(c.tipo)}`}>{c.tipo}</span></div>
            <div style={{ flex: 1 }}>{c.motivo ? c.motivo + (c.entradaReal ? ' · entrada ' + c.entradaReal : '') + (c.salidaReal ? ' · salida ' + c.salidaReal : '') : 'Sin justificar'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

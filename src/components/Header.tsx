'use client';

import type { Session } from '@/lib/auth';

export type TabDef = { key: string; label: string; badge?: string };

export function Header({
  session,
  onSalir,
  tabs,
  vista,
  setVista,
  periodo,
  pct,
  resueltas,
  total,
  pendientes,
  plazoTexto,
}: {
  session: Session;
  onSalir: () => void;
  tabs: TabDef[];
  vista: string;
  setVista: (v: string) => void;
  periodo: string;
  pct: number;
  resueltas: number;
  total: number;
  pendientes: number;
  plazoTexto: string;
}) {
  const iniciales = session.nombre
    .toLowerCase()
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <>
      <header className="nav" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 32px', borderBottom: '1px solid var(--color-divider)', background: 'var(--color-bg)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 19, letterSpacing: '-0.01em' }}>Regularización de Marcajes</span>
          <span className="text-muted" style={{ fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase' }}>SLEP Aconcagua</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={onSalir} style={{ fontSize: 12 }}>Cerrar sesión</button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{session.nombre}</span>
            <span className="text-muted" style={{ fontSize: 11 }}>{session.rol === 'admin' ? 'Gestión de Personas · administración' : ''}</span>
          </div>
          <div style={{ width: 34, height: 34, border: '1px solid var(--color-divider)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: 13, color: 'var(--color-accent-700)' }}>{iniciales}</div>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--color-divider)', padding: '0 32px', background: 'var(--color-neutral-100)' }}>
        <div style={{ display: 'flex', gap: 2, padding: '8px 0' }}>
          {tabs.map((t) => (
            <button key={t.key} type="button" className={`btn ${vista === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setVista(t.key)} style={{ borderRadius: 0, fontSize: 13, letterSpacing: '.02em' }}>
              {t.label}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, opacity: 0.75, marginLeft: 2 }}>{t.badge}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 210 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span className="text-muted" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>Avance {periodo}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--color-neutral-300)', border: '1px solid var(--color-divider)' }}>
              <div style={{ height: '100%', background: 'var(--color-accent)', width: pct + '%' }} />
            </div>
            <span className="text-muted" style={{ fontSize: 11 }}>{resueltas} de {total} resueltas · {pendientes} pendientes</span>
          </div>
          <div style={{ borderLeft: '1px solid var(--color-divider)', paddingLeft: 20, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span className="text-muted" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>Plazo</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, color: 'var(--color-accent-700)' }}>{plazoTexto}</span>
          </div>
        </div>
      </div>
    </>
  );
}

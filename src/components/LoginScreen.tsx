'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type DemoLogin = { nombre: string; correo: string; etiqueta: string; rol: 'admin' | 'jefatura' };

export function LoginScreen({ onEntrar }: { onEntrar: (correo: string) => Promise<string | null> }) {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');
  const [demoLogins, setDemoLogins] = useState<DemoLogin[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get<{ demoLogins: DemoLogin[] }>('/api/auth/demo').then((r) => setDemoLogins(r.demoLogins)).catch(() => {});
  }, []);

  async function entrar(c: string) {
    setEnviando(true);
    const err = await onEntrar(c);
    setEnviando(false);
    setError(err || '');
  }

  return (
    <main style={{ maxWidth: 940, margin: '0 auto', padding: '70px 32px 90px', display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 44, alignItems: 'start' }}>
      <div>
        <h6 className="text-muted" style={{ margin: '0 0 10px' }}>Acceso jefaturas</h6>
        <h1 style={{ fontSize: 40, margin: '0 0 12px', maxWidth: '22ch' }}>Justifique las inconsistencias de marcaje de su equipo</h1>
        <p className="text-muted" style={{ fontSize: 15, maxWidth: '52ch' }}>
          Ingrese con su correo institucional. Verá solo los casos de los funcionarios que dependen de usted según la dotación efectiva vigente.
        </p>
        <div className="field" style={{ marginTop: 24, maxWidth: 400 }}>
          <label>Correo institucional</label>
          <input
            className="input"
            type="email"
            placeholder="nombre.apellido@slepaconcagua.gob.cl"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar(correo)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <button type="button" className="btn btn-primary blueprint" onClick={() => entrar(correo)} disabled={enviando} style={{ padding: '10px 22px' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            Entrar
          </button>
          <span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{error}</span>
        </div>
      </div>

      <div className="blueprint" style={{ padding: 20, background: 'var(--color-neutral-100)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <h6 style={{ margin: '0 0 3px' }}>Accesos de prueba</h6>
        <p className="text-muted" style={{ fontSize: 11.5, margin: '0 0 12px' }}>Toque un correo para entrar con ese perfil.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--color-divider)' }}>
          {demoLogins.map((d) => (
            <button
              key={d.correo}
              type="button"
              onClick={() => entrar(d.correo)}
              style={{ textAlign: 'left', border: 0, background: 'var(--color-bg)', padding: '9px 11px', cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{d.nombre}</span>
                <span className={`tag ${d.rol === 'admin' ? 'tag-accent' : 'tag-outline'}`} style={{ fontSize: 10 }}>{d.etiqueta}</span>
              </div>
              <div className="text-muted" style={{ fontSize: 11 }}>{d.correo}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

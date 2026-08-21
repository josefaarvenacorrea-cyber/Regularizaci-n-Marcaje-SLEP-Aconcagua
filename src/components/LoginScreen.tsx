'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type DemoLogin = { nombre: string; correo: string; clave: string; etiqueta: string; rol: 'admin' | 'jefatura' | 'funcionario' };

export function LoginScreen({ onEntrar }: { onEntrar: (correo: string, clave: string) => Promise<string | null> }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [demoLogins, setDemoLogins] = useState<DemoLogin[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get<{ demoLogins: DemoLogin[] }>('/api/auth/demo').then((r) => setDemoLogins(r.demoLogins)).catch(() => {});
  }, []);

  async function entrar(c: string, cl: string) {
    setEnviando(true);
    const err = await onEntrar(c, cl);
    setEnviando(false);
    setError(err || '');
  }

  const hayDemo = demoLogins.length > 0;

  return (
    <main
      style={{
        maxWidth: hayDemo ? 940 : 560,
        margin: '0 auto',
        padding: '70px 32px 90px',
        display: 'grid',
        gridTemplateColumns: hayDemo ? '1.05fr .95fr' : '1fr',
        gap: 44,
        alignItems: 'start',
      }}
    >
      <div>
        <h6 className="text-muted" style={{ margin: '0 0 10px' }}>Regularización de marcajes</h6>
        <h1 style={{ fontSize: 40, margin: '0 0 12px', maxWidth: '22ch' }}>Justifique las inconsistencias de marcaje de su equipo</h1>
        <p className="text-muted" style={{ fontSize: 15, maxWidth: '52ch' }}>
          Ingrese con su correo institucional y su contraseña (los primeros 4 dígitos de su RUT). Si tiene funcionarios a
          cargo verá los casos de su equipo según la dotación efectiva vigente; si no, verá sus propias inconsistencias.
        </p>
        <div className="field" style={{ marginTop: 24, maxWidth: 400 }}>
          <label>Correo institucional</label>
          <input
            className="input"
            type="email"
            placeholder="nombre.apellido@slepaconcagua.gob.cl"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar(correo, clave)}
          />
        </div>
        <div className="field" style={{ marginTop: 14, maxWidth: 400 }}>
          <label>Contraseña</label>
          <input
            className="input"
            type="password"
            placeholder="Primeros 4 dígitos de su RUT"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar(correo, clave)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <button type="button" className="btn btn-primary blueprint" onClick={() => entrar(correo, clave)} disabled={enviando} style={{ padding: '10px 22px' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            Entrar
          </button>
          <span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{error}</span>
        </div>
      </div>

      {hayDemo && (
        <div className="blueprint" style={{ padding: 20, background: 'var(--color-neutral-100)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h6 style={{ margin: '0 0 3px' }}>Accesos de prueba</h6>
          <p className="text-muted" style={{ fontSize: 11.5, margin: '0 0 12px' }}>Toque un correo para entrar con ese perfil.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--color-divider)' }}>
            {demoLogins.map((d) => (
              <button
                key={d.correo}
                type="button"
                onClick={() => entrar(d.correo, d.clave)}
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
      )}
    </main>
  );
}

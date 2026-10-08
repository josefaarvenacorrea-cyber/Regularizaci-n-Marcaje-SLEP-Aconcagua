'use client';

import { useState } from 'react';

export function LoginScreen({ onEntrar }: { onEntrar: (correo: string, clave: string) => Promise<string | null> }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(c: string, cl: string) {
    setEnviando(true);
    const err = await onEntrar(c, cl);
    setEnviando(false);
    setError(err || '');
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '70px 32px 90px' }}>
      <div>
        <img src="/slep-logo.webp" alt="SLEP Aconcagua" style={{ height: 72, width: 'auto', marginBottom: 28 }} />
        <h6 className="text-muted" style={{ margin: '0 0 10px' }}>Regularización de marcajes</h6>
        <h1 style={{ fontSize: 40, margin: '0 0 12px', maxWidth: '22ch' }}>Justifique las inconsistencias de marcaje de su equipo</h1>
        <p className="text-muted" style={{ fontSize: 15, maxWidth: '52ch' }}>
          Ingrese con su correo institucional y su contraseña. Si tiene funcionarios a cargo verá los casos de su equipo
          según la dotación efectiva vigente; si no, verá sus propias inconsistencias.
        </p>
        <div style={{ background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', fontSize: 13, padding: '10px 14px', maxWidth: 400, marginTop: 20 }}>
          <strong>¿Es su primera vez?</strong> Su contraseña temporal son los primeros 4 dígitos de su RUT. Al ingresar, el
          sistema le pedirá cambiarla — esa será su contraseña de ahí en más.
        </div>
        <div className="field" style={{ marginTop: 16, maxWidth: 400 }}>
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
            placeholder="Contraseña"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar(correo, clave)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <button type="button" className="btn btn-primary blueprint" onClick={() => entrar(correo, clave)} disabled={enviando} style={{ padding: '10px 22px' }}>
            Entrar
          </button>
          <span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{error}</span>
        </div>
      </div>
    </main>
  );
}

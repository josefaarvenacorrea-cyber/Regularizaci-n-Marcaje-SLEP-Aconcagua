'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Session } from '@/lib/auth';

// Pantalla que bloquea el resto de la app mientras la sesión siga marcada
// `debeCambiarClave` — se entra acá recién después de haber pasado el login
// con la contraseña temporal (los primeros 4 dígitos del RUT), así que no
// hace falta pedirla de nuevo.
export function CambiarClave({ onCambiada, onSalir }: { onCambiada: (session: Session) => void; onSalir: () => void }) {
  const [claveNueva, setClaveNueva] = useState('');
  const [claveRepetida, setClaveRepetida] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setError('');
    if (claveNueva.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (claveNueva !== claveRepetida) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }
    setEnviando(true);
    try {
      const r = await api.post<{ session: Session }>('/api/auth/cambiar-clave', { claveNueva });
      onCambiada(r.session);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '70px 32px 90px' }}>
      <h6 className="text-muted" style={{ margin: '0 0 10px' }}>Regularización de marcajes</h6>
      <h1 style={{ fontSize: 30, margin: '0 0 12px' }}>Cambie su contraseña</h1>
      <p className="text-muted" style={{ fontSize: 14, maxWidth: '52ch' }}>
        Entró con la contraseña temporal (los primeros dígitos de su RUT). Antes de continuar, elija una propia — algo
        que recuerde fácil, pero que no sea obvio para otra persona.
      </p>
      <div className="field" style={{ marginTop: 24 }}>
        <label>Nueva contraseña</label>
        <input
          className="input"
          type="password"
          value={claveNueva}
          onChange={(e) => setClaveNueva(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
        />
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label>Repita la nueva contraseña</label>
        <input
          className="input"
          type="password"
          value={claveRepetida}
          onChange={(e) => setClaveRepetida(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
        <button type="button" className="btn btn-primary blueprint" onClick={guardar} disabled={enviando} style={{ padding: '10px 22px' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          Guardar y continuar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSalir}>Cerrar sesión</button>
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 10 }}>{error}</div>}
    </main>
  );
}

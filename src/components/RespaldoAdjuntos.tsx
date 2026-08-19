'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { RespaldoMeta } from '@/lib/casos';

function tamanoFmt(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Mismo tope que el servidor (ver comentario en la ruta de respaldo):
// Vercel corta el cuerpo de la función en ~4.5 MB a nivel de plataforma, así
// que conviene avisar antes de subir en vez de dejar que el navegador
// dispare un request que la plataforma va a cortar con un error críptico.
const MAX_BYTES = 4 * 1024 * 1024;

// En modo compacto (una fila de la tabla "Mis casos", que puede mostrar
// cientos de casos a la vez) NO se pide la lista de archivos hasta que la
// jefatura hace clic para abrirla — si cada fila pidiera su lista al
// montarse, ver la tabla completa dispararía cientos de requests en
// paralelo. El conteo inicial (gratis: ya viene con el caso) alcanza para
// mostrar la etiqueta sin abrir nada.
export function RespaldoAdjuntos({
  casoId,
  disabled,
  compact,
  countInicial,
  onCambio,
}: {
  casoId: string;
  disabled: boolean;
  compact?: boolean;
  countInicial?: number;
  onCambio?: () => void;
}) {
  const [abierto, setAbierto] = useState(!compact);
  const [archivos, setArchivos] = useState<RespaldoMeta[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto || archivos !== null) return;
    let vivo = true;
    api
      .get<{ archivos: RespaldoMeta[] }>(`/api/casos/${encodeURIComponent(casoId)}/respaldo`)
      .then((r) => vivo && setArchivos(r.archivos))
      .catch(() => vivo && setArchivos([]));
    return () => {
      vivo = false;
    };
  }, [abierto, archivos, casoId]);

  async function subir(file: File) {
    setError('');
    if (file.size > MAX_BYTES) {
      setError('El archivo pesa ' + tamanoFmt(file.size) + '; el máximo permitido es 4 MB. Comprima el PDF o la imagen e intente de nuevo.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setSubiendo(true);
    const form = new FormData();
    form.append('archivo', file);
    try {
      const r = await api.postForm<{ archivos: RespaldoMeta[] }>(`/api/casos/${encodeURIComponent(casoId)}/respaldo`, form);
      setArchivos(r.archivos);
      onCambio?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function eliminar(id: number) {
    setError('');
    try {
      const res = await fetch(`/api/casos/${encodeURIComponent(casoId)}/respaldo/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudo quitar el archivo.');
      setArchivos(body.archivos);
      onCambio?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar el archivo.');
    }
  }

  const fontSize = compact ? 11 : 12.5;

  if (!abierto) {
    const n = countInicial || 0;
    return (
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setAbierto(true)}
        style={{ fontSize, fontFamily: 'var(--font-body)' }}
      >
        {n > 0 ? '📎 ' + n + (n === 1 ? ' archivo' : ' archivos') : disabled ? 'Sin archivos' : '📎 Adjuntar respaldo'}
      </button>
    );
  }

  return (
    <div style={{ fontSize }}>
      {archivos === null && <span className="text-muted">Cargando…</span>}
      {archivos && archivos.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
          {archivos.map((a) => (
            <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <a
                href={`/api/casos/${encodeURIComponent(casoId)}/respaldo/${a.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--color-text)', textDecoration: 'none' }}
                title={tamanoFmt(a.tamano)}
              >
                📎 {a.nombreArchivo}
              </a>
              {!disabled && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => eliminar(a.id)}
                  style={{ fontSize: fontSize - 1, padding: '0 2px', fontFamily: 'var(--font-body)' }}
                  aria-label={'Quitar ' + a.nombreArchivo}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <label className="btn btn-ghost" style={{ fontSize, fontFamily: 'var(--font-body)', cursor: subiendo ? 'wait' : 'pointer', display: 'inline-block' }}>
          {subiendo ? 'Subiendo…' : (archivos && archivos.length ? '+ Adjuntar otro' : '📎 Adjuntar respaldo')}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx"
            style={{ display: 'none' }}
            disabled={subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subir(f);
            }}
          />
        </label>
      )}
      {error && <div style={{ color: 'var(--color-accent-700)', marginTop: 2 }}>{error}</div>}
    </div>
  );
}

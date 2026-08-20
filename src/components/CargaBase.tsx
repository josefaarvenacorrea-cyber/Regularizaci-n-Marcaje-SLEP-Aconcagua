'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';

function TarjetaCarga({
  descripcion,
  etiquetaBoton,
  endpoint,
  panelTitulo,
  panelLineas,
  onCargada,
}: {
  descripcion: React.ReactNode;
  etiquetaBoton: string;
  endpoint: string;
  panelTitulo: string;
  panelLineas: { label: string; valor: string | number }[];
  onCargada: (mensaje: string) => void;
}) {
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onArchivo(file: File | undefined) {
    if (!file) return;
    setSubiendo(true);
    setError('');
    setMensaje('');
    const form = new FormData();
    form.append('archivo', file);
    try {
      const r = await api.postForm<{ mensajeCarga: string }>(endpoint, form);
      setMensaje(r.mensajeCarga);
      onCargada(r.mensajeCarga);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar el archivo.');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <p className="text-muted" style={{ maxWidth: '64ch', fontSize: 14 }}>{descripcion}</p>
      <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'stretch' }}>
        <label className="blueprint" style={{ flex: 1, display: 'block', padding: '30px 26px', textAlign: 'center', cursor: subiendo ? 'wait' : 'pointer', background: 'var(--color-neutral-100)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <input ref={inputRef} type="file" accept=".xlsx,.csv" disabled={subiendo} onChange={(e) => onArchivo(e.target.files?.[0])} style={{ display: 'none' }} />
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth={1.5} style={{ margin: '0 auto 10px' }}>
            <path d="M12 16V4m0 0L8 8m4-4 4 4" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{subiendo ? 'Procesando…' : etiquetaBoton}</div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>.xlsx o .csv · se procesa en el servidor</div>
        </label>
        <div className="blueprint" style={{ width: 290, padding: 18, background: 'var(--color-bg)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <h6 style={{ margin: '0 0 8px' }}>{panelTitulo}</h6>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            {panelLineas.map((l) => (
              <div key={l.label}><span className="text-muted">{l.label}</span> · {l.valor}</div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 10 }}>{error || mensaje}</div>
        </div>
      </div>
    </>
  );
}

function CorreccionAtraso({ onCorregido }: { onCorregido: () => void }) {
  const [mensaje, setMensaje] = useState('');
  const [corrigiendo, setCorrigiendo] = useState(false);

  async function corregir() {
    setCorrigiendo(true);
    setMensaje('');
    try {
      const r = await api.post<{ reclasificados: number; eliminados: number }>('/api/admin/corregir-atraso');
      setMensaje(
        r.reclasificados + ' casos reclasificados de Atraso a Falta Salida, ' + r.eliminados + ' eliminados por no ser una inconsistencia real.'
      );
      onCorregido();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo corregir la clasificación.');
    } finally {
      setCorrigiendo(false);
    }
  }

  return (
    <div className="blueprint" style={{ padding: 18, background: 'var(--color-neutral-100)', marginTop: 26 }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h6 style={{ margin: '0 0 6px' }}>Corrección: Atraso mal clasificado</h6>
      <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 10px', maxWidth: '70ch' }}>
        Corrige de una vez los casos &ldquo;Atraso&rdquo; ya cargados cuya entrada en realidad cae dentro del margen de tolerancia del
        turno (no eran atrasos reales) — los reclasifica a &ldquo;Falta Salida&rdquo; si falta esa marca, o los elimina si el día no
        tiene ninguna inconsistencia real. Las cargas nuevas ya se corrigen solas; esto es solo para lo que ya estaba mal
        cargado antes de ese cambio.
      </p>
      <button type="button" className="btn btn-secondary" onClick={corregir} disabled={corrigiendo}>
        {corrigiendo ? 'Corrigiendo…' : 'Corregir clasificación de Atraso'}
      </button>
      {mensaje && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 8 }}>{mensaje}</div>}
    </div>
  );
}

export function CargaBase({
  periodo,
  origen,
  totalGlobal,
  personasGlobal,
  casosAsignados,
  casosSinJefatura,
  casosNoIdentificados,
  funcionariosDotacion,
  jefaturasDotacion,
  onCargada,
  onDotacionCargada,
}: {
  periodo: string;
  origen: string;
  totalGlobal: number;
  personasGlobal: number;
  casosAsignados: number;
  casosSinJefatura: number;
  casosNoIdentificados: number;
  funcionariosDotacion: number;
  jefaturasDotacion: number;
  onCargada: () => void;
  onDotacionCargada: () => void;
}) {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px 80px' }}>
      <h6 className="text-muted" style={{ margin: '0 0 10px' }}>Administración · Gestión de Personas</h6>

      <h1 style={{ fontSize: 30, margin: '0 0 4px' }}>Dotación efectiva</h1>
      <TarjetaCarga
        descripcion={
          <>
            La dotación es la estructura organizacional vigente: quién depende de quién, y con qué correo entra cada jefatura.
            Reemplaza la dotación completa cada vez que la suba (no se concilia fila a fila como las inconsistencias), y las
            inconsistencias ya cargadas se vuelven a cruzar automáticamente contra la dotación nueva. Se leen columnas como{' '}
            <em>RUT, Nombre, Área/Subdirección, Cargo, Estamento, Correo institucional</em> y <em>Jefatura</em>.
          </>
        }
        etiquetaBoton="Reemplazar la dotación efectiva"
        endpoint="/api/admin/dotacion"
        panelTitulo="Dotación activa"
        panelLineas={[
          { label: 'Funcionarios', valor: funcionariosDotacion },
          { label: 'Jefaturas', valor: jefaturasDotacion },
        ]}
        onCargada={onDotacionCargada}
      />

      <h1 style={{ fontSize: 30, margin: '32px 0 4px' }}>Base de inconsistencias del período</h1>
      <TarjetaCarga
        descripcion={
          <>
            Puede subir un archivo cada vez que tenga novedades del reloj control: la carga se concilia con la base vigente por
            funcionario, fecha y tipo de inconsistencia — agrega los casos nuevos y actualiza los datos de los que ya existían,
            sin borrar las justificaciones que las jefaturas ya hayan registrado. Se leen las columnas{' '}
            <em>Apellidos, Nombre, Identificador, Grupo, Fecha, Turno, Entró, Salió</em> y <em>Observado</em>, y cada fila se
            cruza por RUT con la dotación efectiva para determinar la jefatura responsable.
          </>
        }
        etiquetaBoton="Actualizar la base con un archivo del reloj control"
        endpoint="/api/admin/upload"
        panelTitulo="Base activa"
        panelLineas={[
          { label: 'Archivo', valor: origen },
          { label: 'Filas', valor: totalGlobal },
          { label: 'Funcionarios', valor: personasGlobal },
          { label: 'Período', valor: periodo },
        ]}
        onCargada={onCargada}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--color-divider)', border: '1px solid var(--color-divider)', marginTop: 26 }}>
        <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
          <div className="text-muted" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>Asignadas a una jefatura</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1.1 }}>{casosAsignados}</div>
        </div>
        <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
          <div className="text-muted" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>Sin jefatura en la dotación</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1.1 }}>{casosSinJefatura}</div>
        </div>
        <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
          <div className="text-muted" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>RUT no está en la dotación</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1.1 }}>{casosNoIdentificados}</div>
        </div>
      </div>
      <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
        Los casos sin jefatura o con RUT ausente de la dotación no se asignan a nadie: corrija la columna <em>Jefatura</em> de la dotación o el RUT del reloj control y vuelva a cargar la base.
      </p>

      <CorreccionAtraso onCorregido={onCargada} />
    </main>
  );
}

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

function RegularizacionMasiva({ onRegularizado }: { onRegularizado: () => void }) {
  const [fecha, setFecha] = useState('2026-01-02');
  const [motivo, setMotivo] = useState('Pruebas por instalación de reloj de marcación');
  const [horaEntrada, setHoraEntrada] = useState('08:00');
  const [horaSalida, setHoraSalida] = useState('17:00');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);

  async function regularizar() {
    if (!fecha || !motivo.trim()) {
      setMensaje('Complete la fecha y el motivo.');
      return;
    }
    const ok = window.confirm(
      'Esto va a regularizar de una vez TODOS los casos pendientes del ' +
        fecha +
        ' con el motivo "' +
        motivo +
        '"' +
        (horaEntrada ? ', entrada ' + horaEntrada : '') +
        (horaSalida ? ', salida ' + horaSalida : '') +
        '. No afecta los casos que la jefatura ya haya enviado. ¿Confirma?'
    );
    if (!ok) return;
    setProcesando(true);
    setMensaje('');
    try {
      const r = await api.post<{ afectados: number }>('/api/admin/regularizar-masivo', { fecha, motivo, horaEntrada, horaSalida });
      setMensaje(r.afectados + ' casos del ' + fecha + ' quedaron regularizados con ese motivo.');
      onRegularizado();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo regularizar en bloque.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="blueprint" style={{ padding: 18, background: 'var(--color-neutral-100)', marginTop: 26 }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h6 style={{ margin: '0 0 6px' }}>Regularización masiva por fecha</h6>
      <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 12px', maxWidth: '70ch' }}>
        Para días excepcionales donde casi todo el personal queda con inconsistencias por la misma razón (p. ej. la puesta
        en marcha del reloj control): regulariza de una vez todos los casos pendientes de esa fecha con el mismo motivo y
        horario. No toca los casos que la jefatura ya haya enviado, y no manda correos de notificación.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12.5 }}>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12.5, flex: '1 1 260px' }}>
          Motivo
          <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </label>
        <label style={{ fontSize: 12.5 }}>
          Hora entrada
          <input type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12.5 }}>
          Hora salida
          <input type="time" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={regularizar} disabled={procesando}>
          {procesando ? 'Regularizando…' : 'Regularizar en bloque'}
        </button>
      </div>
      {mensaje && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 10 }}>{mensaje}</div>}
    </div>
  );
}

function CorreccionIngreso({ onCorregido }: { onCorregido: () => void }) {
  const [rut, setRut] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);

  async function corregir() {
    if (!rut.trim() || !fechaIngreso) {
      setMensaje('Complete el RUT y la fecha de ingreso.');
      return;
    }
    const ok = window.confirm(
      'Esto va a eliminar todas las inconsistencias de ' +
        rut +
        ' anteriores al ' +
        fechaIngreso +
        ', y regularizar automáticamente el ' +
        fechaIngreso +
        ' como primer día. ¿Confirma?'
    );
    if (!ok) return;
    setProcesando(true);
    setMensaje('');
    try {
      const r = await api.post<{ eliminados: number; regularizados: number }>('/api/admin/corregir-ingreso', { rut, fechaIngreso });
      setMensaje(
        r.eliminados + ' inconsistencias anteriores al ' + fechaIngreso + ' fueron eliminadas, y ' + r.regularizados + ' casos del día de ingreso quedaron regularizados como primer día.'
      );
      onCorregido();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo corregir.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="blueprint" style={{ padding: 18, background: 'var(--color-neutral-100)', marginTop: 26 }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h6 style={{ margin: '0 0 6px' }}>Corrección: inconsistencias de antes del ingreso</h6>
      <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 12px', maxWidth: '70ch' }}>
        Para cuando a alguien le quedan inconsistencias de fechas anteriores a su ingreso real al servicio (datos que no
        se depuraron bien en una carga anterior). Elimina las inconsistencias de esa persona de antes de la fecha que
        indique, y regulariza automáticamente el día de ingreso como &ldquo;Primer día de trabajo&rdquo;.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12.5 }}>
          RUT de la persona
          <input type="text" placeholder="12.345.678-9" value={rut} onChange={(e) => setRut(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12.5 }}>
          Fecha de ingreso
          <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={corregir} disabled={procesando}>
          {procesando ? 'Corrigiendo…' : 'Corregir'}
        </button>
      </div>
      {mensaje && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 10 }}>{mensaje}</div>}
    </div>
  );
}

function RegularizacionExitosa({ onRegularizado }: { onRegularizado: () => void }) {
  const [rut, setRut] = useState('');
  const [fecha, setFecha] = useState('');
  const [horaEntrada, setHoraEntrada] = useState('');
  const [horaSalida, setHoraSalida] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);

  async function regularizar() {
    if (!rut.trim() || !fecha || (!horaEntrada && !horaSalida)) {
      setMensaje('Complete el RUT, la fecha y al menos una hora.');
      return;
    }
    const ok = window.confirm(
      'Esto va a regularizar el ' +
        fecha +
        ' de ' +
        rut +
        ' como marcaje realizado con éxito' +
        (horaEntrada ? ', entrada ' + horaEntrada : '') +
        (horaSalida ? ', salida ' + horaSalida : '') +
        ', sin pedir ningún antecedente. Es solo para cuando el marcaje sí existe en GeoVictoria pero no cruzó bien con el reloj de control. ¿Confirma?'
    );
    if (!ok) return;
    setProcesando(true);
    setMensaje('');
    try {
      const r = await api.post<{ afectados: number }>('/api/admin/regularizar-exitoso', { rut, fecha, horaEntrada, horaSalida });
      setMensaje(r.afectados + ' caso(s) del ' + fecha + ' quedaron regularizados como marcaje exitoso.');
      onRegularizado();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo regularizar.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="blueprint" style={{ padding: 18, background: 'var(--color-neutral-100)', marginTop: 26 }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h6 style={{ margin: '0 0 6px' }}>Regularización de marcajes realizados con éxito</h6>
      <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 12px', maxWidth: '70ch' }}>
        Para cuando el cruce entre el reloj de control y GeoVictoria falla y deja una inconsistencia falsa: la persona
        sí marcó con éxito, solo que el dato no cruzó bien. Regulariza directo con las horas que indique, sin pedir
        ningún antecedente ni motivo — esta opción es exclusiva de administración.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12.5 }}>
          RUT de la persona
          <input type="text" placeholder="12.345.678-9" value={rut} onChange={(e) => setRut(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12.5 }}>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12.5 }}>
          Hora entrada
          <input type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12.5 }}>
          Hora salida
          <input type="time" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={regularizar} disabled={procesando}>
          {procesando ? 'Regularizando…' : 'Regularizar como exitoso'}
        </button>
      </div>
      {mensaje && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 10 }}>{mensaje}</div>}
    </div>
  );
}

function RestablecerClave() {
  const [correo, setCorreo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);

  async function restablecer() {
    if (!correo.trim()) {
      setMensaje('Ingrese el correo de la persona.');
      return;
    }
    const ok = window.confirm(
      'Esto va a borrar la contraseña propia de ' + correo + '. Va a volver a entrar con los primeros 4 dígitos de su RUT, y el sistema le va a pedir elegir una nueva. ¿Confirma?'
    );
    if (!ok) return;
    setProcesando(true);
    setMensaje('');
    try {
      const r = await api.post<{ ok: boolean; nombre: string }>('/api/admin/restablecer-clave', { correo });
      setMensaje('Contraseña reestablecida para ' + r.nombre + '. Ya puede entrar con los primeros 4 dígitos de su RUT.');
      setCorreo('');
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo reestablecer la contraseña.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="blueprint" style={{ padding: 18, background: 'var(--color-neutral-100)', marginTop: 26 }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h6 style={{ margin: '0 0 6px' }}>Reestablecer contraseña</h6>
      <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 12px', maxWidth: '70ch' }}>
        Para cuando una jefatura o funcionario olvida su contraseña. Borra la que había elegido y la deja de nuevo con
        la temporal (los primeros 4 dígitos de su RUT) — al entrar, el sistema la va a obligar a elegir una nueva.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12.5, flex: '1 1 280px' }}>
          Correo institucional
          <input type="email" placeholder="nombre.apellido@slepaconcagua.gob.cl" value={correo} onChange={(e) => setCorreo(e.target.value)} style={{ display: 'block', marginTop: 4, width: '100%' }} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={restablecer} disabled={procesando}>
          {procesando ? 'Reestableciendo…' : 'Reestablecer contraseña'}
        </button>
      </div>
      {mensaje && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 10 }}>{mensaje}</div>}
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
      <RegularizacionMasiva onRegularizado={onCargada} />
      <CorreccionIngreso onCorregido={onCargada} />
      <RegularizacionExitosa onRegularizado={onCargada} />
      <RestablecerClave />
    </main>
  );
}

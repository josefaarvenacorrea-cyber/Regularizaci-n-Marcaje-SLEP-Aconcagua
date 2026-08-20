'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';

export function RegularizacionMasivaJefatura({ onRegularizado }: { onRegularizado: () => void }) {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [horaEntrada, setHoraEntrada] = useState('08:00');
  const [horaSalida, setHoraSalida] = useState('17:00');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function regularizar() {
    if (!fechaDesde || !motivo.trim()) {
      setMensaje('Complete al menos la fecha y el motivo.');
      return;
    }
    const hasta = fechaHasta || fechaDesde;
    const rango = hasta === fechaDesde ? 'del ' + fechaDesde : 'entre el ' + fechaDesde + ' y el ' + hasta;
    const ok = window.confirm(
      'Esto va a regularizar de una vez todos los casos pendientes de su equipo ' +
        rango +
        ' con el motivo "' +
        motivo +
        '"' +
        (horaEntrada ? ', entrada ' + horaEntrada : '') +
        (horaSalida ? ', salida ' + horaSalida : '') +
        '. No afecta los casos que ya haya enviado antes. ¿Confirma?'
    );
    if (!ok) return;

    setProcesando(true);
    setMensaje('');
    try {
      const form = new FormData();
      form.append('fechaDesde', fechaDesde);
      form.append('fechaHasta', hasta);
      form.append('motivo', motivo.trim());
      form.append('horaEntrada', horaEntrada);
      form.append('horaSalida', horaSalida);
      const archivo = inputRef.current?.files?.[0];
      if (archivo) form.append('archivo', archivo);

      const r = await api.postForm<{ afectados: number }>('/api/jefatura/regularizar-masivo', form);
      setMensaje(
        r.afectados === 0
          ? 'No había casos pendientes de su equipo en ese rango de fechas.'
          : r.afectados + (r.afectados === 1 ? ' caso quedó regularizado.' : ' casos quedaron regularizados.') +
              (archivo ? ' El documento se adjuntó en cada uno.' : '')
      );
      if (inputRef.current) inputRef.current.value = '';
      onRegularizado();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo regularizar en bloque.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '32px 32px 90px' }}>
      <h1 style={{ fontSize: 30, margin: '0 0 4px' }}>Regularización grupal</h1>
      <p className="text-muted" style={{ fontSize: 13, margin: '0 0 22px', maxWidth: '62ch' }}>
        Esta función está pensada solo para cuando su equipo debe ausentarse por una actividad grupal (una capacitación,
        una salida a terreno, etc.) y busca agilizar el trámite: regulariza de una vez, con el mismo motivo y horario,
        todos los casos pendientes de su equipo en el rango de fechas que indique. No toca los casos que ya haya
        enviado antes — esos hay que deshacerlos primero si necesita corregirlos.
      </p>

      <div className="blueprint" style={{ padding: 22, background: 'var(--color-neutral-100)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12.5 }}>
            Desde
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12.5 }}>
            Hasta (opcional, si es un solo día déjelo vacío)
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
          </label>
        </div>

        <label style={{ fontSize: 12.5, display: 'block', marginTop: 14 }}>
          Motivo
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: Capacitación institucional fuera de dependencias"
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
          <label style={{ fontSize: 12.5 }}>
            Hora entrada
            <input type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12.5 }}>
            Hora salida
            <input type="time" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
          </label>
        </div>

        <label style={{ fontSize: 12.5, display: 'block', marginTop: 14 }}>
          Documento de respaldo (opcional — memo, nómina de asistencia, etc.)
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx" style={{ display: 'block', marginTop: 4 }} />
        </label>
        <div className="text-muted" style={{ fontSize: 11.5, marginTop: 4 }}>
          PDF, imagen o Word, máximo 4 MB. Si lo adjunta, queda guardado en cada uno de los casos que se regularicen.
        </div>

        <button type="button" className="btn btn-primary" onClick={regularizar} disabled={procesando} style={{ marginTop: 18 }}>
          {procesando ? 'Regularizando…' : 'Regularizar en bloque'}
        </button>
        {mensaje && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 10 }}>{mensaje}</div>}
      </div>
    </main>
  );
}

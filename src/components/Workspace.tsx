'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Session } from '@/lib/auth';
import type { Caso } from '@/lib/casos';
import { completa as calcCompleta, key as normKey } from '@/lib/reglas';
import { LoginScreen } from './LoginScreen';
import { Header, type TabDef } from './Header';
import { CargaBase } from './CargaBase';
import { PanelAvance, type JefaturaResumen } from './PanelAvance';
import { Bandeja } from './Bandeja';
import { RevisionRapida } from './RevisionRapida';
import { CierreEnvio, type RegistroEntry } from './CierreEnvio';
import { HistorialDrawer } from './HistorialDrawer';

type Resumen = {
  jefaturas: JefaturaResumen[];
  casosSinJefatura: number;
  casosNoIdentificados: number;
  casosAsignados: number;
  jefaturasPendientes: number;
  funcionariosDotacion: number;
};

async function descargarExport(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'No se pudo exportar.');
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename="([^"]+)"/.exec(cd);
  const filename = m ? m[1] : 'Regularizaciones.xlsx';
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
  return filename;
}

export function Workspace() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [vista, setVista] = useState('bandeja');
  const [verHuerfanos, setVerHuerfanos] = useState(false);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [registro, setRegistro] = useState<RegistroEntry[] | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [histRut, setHistRut] = useState<string | null>(null);
  const [histItems, setHistItems] = useState<Caso[] | null>(null);
  const [firma, setFirma] = useState(false);
  const [notificar, setNotificar] = useState(true);
  const [filtroJefaturaActivo, setFiltroJefaturaActivo] = useState<string | null>(null);
  const [mensajeExcel, setMensajeExcel] = useState('');
  const [mensajeEnviado, setMensajeEnviado] = useState('');
  const [avisoGlobal, setAvisoGlobal] = useState('');

  const esAdmin = session?.rol === 'admin';
  const horaSoloOlvido = config.horaSoloOlvido === 'true';
  const cascada = config.cascada === 'true';
  const segundaInstancia = config.segundaInstancia !== 'false';
  const mostrarTurno = config.mostrarTurno !== 'false';
  const periodo = config.periodo || '';
  const plazoTexto = config.plazoTexto || '';
  const rutaRepositorio = config.rutaRepositorio || '';
  const origen = config.origen || '';

  const fetchSession = useCallback(async () => {
    try {
      const r = await api.get<{ session: Session | null; config: Record<string, string> }>('/api/session');
      setSession(r.session);
      setConfig(r.config);
      return r.session;
    } catch {
      setSession(null);
      return null;
    }
  }, []);

  const fetchCasos = useCallback(async (huerfanos: boolean) => {
    try {
      const r = await api.get<{ casos: Caso[] }>('/api/casos' + (huerfanos ? '?huerfanos=1' : ''));
      setCasos(r.casos);
    } catch (e) {
      setAvisoGlobal(e instanceof ApiError ? e.message : 'No se pudieron cargar los casos.');
    }
  }, []);

  const fetchResumen = useCallback(async () => {
    try {
      const r = await api.get<Resumen>('/api/admin/resumen');
      setResumen(r);
    } catch {
      // el panel de avance queda con los últimos datos conocidos
    }
  }, []);

  const fetchRegistro = useCallback(async () => {
    try {
      const r = await api.get<{ registro: RegistroEntry[] }>('/api/admin/registro');
      setRegistro(r.registro);
    } catch {
      // el registro de archivos queda con los últimos datos conocidos
    }
  }, []);

  useEffect(() => {
    // Carga inicial de sesión desde el servidor (cookie httpOnly, no accesible
    // por otra vía). El estado que fija no es derivable de props/estado local,
    // así que un fetch-on-mount es el patrón correcto aunque el lint de
    // React Compiler (pensado para código que sí usa el compilador, que este
    // proyecto no habilitó) lo marque como sospechoso.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCasos(session.rol === 'admin' && verHuerfanos);
    if (session.rol === 'admin') {
      fetchResumen();
      fetchRegistro();
    }
  }, [session, verHuerfanos, fetchCasos, fetchResumen, fetchRegistro]);

  async function entrar(correo: string): Promise<string | null> {
    try {
      const r = await api.post<{ session: Session }>('/api/auth/login', { correo });
      setSession(r.session);
      setVerHuerfanos(false);
      setFiltroJefaturaActivo(null);
      setFirma(false);
      setMensajeExcel('');
      setMensajeEnviado('');
      setCursorId(null);
      setVista(r.session.rol === 'admin' ? 'panel' : 'bandeja');
      const cfg = await api.get<{ session: Session | null; config: Record<string, string> }>('/api/session');
      setConfig(cfg.config);
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : 'No se pudo iniciar sesión.';
    }
  }

  async function salir() {
    await api.post('/api/auth/logout').catch(() => {});
    setSession(null);
    setCasos([]);
    setResumen(null);
    setRegistro(null);
    setVista('bandeja');
    setVerHuerfanos(false);
    setFiltroJefaturaActivo(null);
    setHistRut(null);
  }

  const onUpdate = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setCasos((prev) => prev.map((c) => (c.id === id ? { ...c, ...mapPatchOptimista(patch) } : c)));
      try {
        const r = await api.patch<{ caso: Caso }>(`/api/casos/${encodeURIComponent(id)}`, patch);
        setCasos((prev) => prev.map((c) => (c.id === id ? r.caso : c)));
        if (esAdmin) fetchResumen().catch(() => {});
      } catch {
        setAvisoGlobal('No se pudo guardar el cambio. Reintente.');
        fetchCasos(esAdmin && verHuerfanos).catch(() => {});
      }
    },
    [esAdmin, verHuerfanos, fetchCasos, fetchResumen]
  );

  async function onHistorial(rut: string) {
    setHistRut(rut);
    setHistItems(null);
    try {
      const r = await api.get<{ items: Caso[] }>(`/api/casos/historial/${encodeURIComponent(rut)}`);
      setHistItems(r.items);
    } catch {
      setHistItems([]);
    }
  }

  async function onCargada() {
    await Promise.all([fetchCasos(false), fetchResumen(), fetchSession()]);
    setVerHuerfanos(false);
    setFiltroJefaturaActivo(null);
  }

  function onVerHuerfanos() {
    setVerHuerfanos(true);
    setFiltroJefaturaActivo(null);
    setVista('bandeja');
  }

  function onVerCasos(nombreJefatura: string) {
    setVerHuerfanos(false);
    setFiltroJefaturaActivo(nombreJefatura);
    setVista('bandeja');
  }

  async function onExportar(scope: 'normal' | 'consolidado') {
    const params = new URLSearchParams();
    if (scope === 'consolidado') params.set('scope', 'consolidado');
    if (esAdmin && verHuerfanos) params.set('huerfanos', '1');
    try {
      const filename = await descargarExport('/api/export?' + params.toString());
      setMensajeExcel('Excel descargado (' + filename + ').');
      if (esAdmin) fetchRegistro().catch(() => {});
    } catch (e) {
      setMensajeExcel(e instanceof Error ? e.message : 'No se pudo exportar.');
    }
  }

  function onEnviar() {
    setMensajeEnviado('Enviado a Gestión de Personas el ' + new Date().toLocaleString('es-CL') + (notificar ? ' · funcionarios notificados' : ''));
  }

  async function onDescargarRegistro(id: number) {
    try {
      await descargarExport('/api/admin/registro/' + id);
    } catch (e) {
      setAvisoGlobal(e instanceof Error ? e.message : 'No se pudo descargar el archivo.');
    }
  }

  const casosBandeja = useMemo(() => {
    if (!filtroJefaturaActivo) return casos;
    const k = normKey(filtroJefaturaActivo);
    return casos.filter((c) => normKey(c.jefatura || '') === k);
  }, [casos, filtroJefaturaActivo]);

  const total = casos.length;
  const resueltas = casos.filter((c) =>
    calcCompleta({ tipo: c.tipo, motivo: c.motivo, entradaReal: c.entradaReal, salidaReal: c.salidaReal, obs: c.obs, entro: c.entro, salio: c.salio }, horaSoloOlvido)
  ).length;
  const pendientes = total - resueltas;
  const pct = total ? Math.round((resueltas / total) * 100) : 0;

  const tabs: TabDef[] = useMemo(() => {
    if (esAdmin) {
      return [
        { key: 'carga', label: 'Cargar base' },
        { key: 'panel', label: 'Avance por jefatura' },
        { key: 'bandeja', label: 'Todos los casos', badge: total ? String(total) : '' },
        { key: 'envio', label: 'Excel y repositorio' },
      ];
    }
    return [
      { key: 'bandeja', label: 'Mis casos', badge: total ? String(total) : '' },
      { key: 'rapida', label: 'Revisión rápida', badge: pendientes ? String(pendientes) : '' },
      { key: 'envio', label: 'Cierre y Excel' },
    ];
  }, [esAdmin, total, pendientes]);

  if (session === undefined) {
    return <div style={{ padding: 60, textAlign: 'center' }} className="text-muted">Cargando…</div>;
  }

  if (!session) {
    return <LoginScreen onEntrar={entrar} />;
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>
      <Header
        session={session}
        onSalir={salir}
        tabs={tabs}
        vista={vista}
        setVista={setVista}
        periodo={periodo}
        pct={pct}
        resueltas={resueltas}
        total={total}
        pendientes={pendientes}
        plazoTexto={plazoTexto}
      />

      {avisoGlobal && (
        <div style={{ padding: '8px 32px', fontSize: 12, color: 'var(--color-accent-700)', background: 'var(--color-accent-100)' }}>
          {avisoGlobal} <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setAvisoGlobal('')}>Cerrar</button>
        </div>
      )}

      {esAdmin && vista === 'carga' && (
        <CargaBase
          periodo={periodo}
          origen={origen}
          totalGlobal={casos.length}
          personasGlobal={new Set(casos.map((c) => c.rut)).size}
          casosAsignados={resumen?.casosAsignados ?? 0}
          casosSinJefatura={resumen?.casosSinJefatura ?? 0}
          casosNoIdentificados={resumen?.casosNoIdentificados ?? 0}
          funcionariosDotacion={resumen?.funcionariosDotacion ?? 0}
          jefaturasDotacion={resumen?.jefaturas.length ?? 0}
          onCargada={onCargada}
          onDotacionCargada={onCargada}
        />
      )}

      {esAdmin && vista === 'panel' && resumen && (
        <PanelAvance
          periodo={periodo}
          jefaturas={resumen.jefaturas}
          casosSinJefatura={resumen.casosSinJefatura}
          casosNoIdentificados={resumen.casosNoIdentificados}
          jefaturasPendientes={resumen.jefaturasPendientes}
          plazoTexto={plazoTexto}
          cascada={cascada}
          onVerCasos={onVerCasos}
          onVerHuerfanos={onVerHuerfanos}
        />
      )}

      {vista === 'bandeja' && (
        <>
          {esAdmin && filtroJefaturaActivo && (
            <div style={{ padding: '10px 32px 0', fontSize: 12 }}>
              Viendo los casos de <strong>{filtroJefaturaActivo}</strong>.{' '}
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setFiltroJefaturaActivo(null)}>Quitar filtro</button>
            </div>
          )}
          {esAdmin && verHuerfanos && (
            <div style={{ padding: '10px 32px 0', fontSize: 12 }}>
              Viendo casos <strong>sin jefatura responsable</strong>.{' '}
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setVerHuerfanos(false)}>Ver todos</button>
            </div>
          )}
          <Bandeja
            casos={casosBandeja}
            horaSoloOlvido={horaSoloOlvido}
            esAdmin={esAdmin}
            mostrarTurno={mostrarTurno}
            onUpdate={onUpdate}
            onHistorial={onHistorial}
            irEnvio={() => setVista('envio')}
            irRapida={() => setVista('rapida')}
          />
        </>
      )}

      {!esAdmin && vista === 'rapida' && (
        <RevisionRapida
          casos={casos}
          horaSoloOlvido={horaSoloOlvido}
          cursorId={cursorId}
          setCursorId={setCursorId}
          onUpdate={onUpdate}
          irEnvio={() => setVista('envio')}
        />
      )}

      {vista === 'envio' && (
        <CierreEnvio
          session={session}
          casos={casos}
          horaSoloOlvido={horaSoloOlvido}
          esAdmin={esAdmin}
          verHuerfanos={verHuerfanos}
          periodo={periodo}
          plazoTexto={plazoTexto}
          rutaRepositorio={rutaRepositorio}
          segundaInstancia={segundaInstancia}
          firma={firma}
          setFirma={setFirma}
          notificar={notificar}
          setNotificar={setNotificar}
          onExportar={() => onExportar('normal')}
          onConsolidado={() => onExportar('consolidado')}
          onEnviar={onEnviar}
          mensajeExcel={mensajeExcel}
          mensajeEnviado={mensajeEnviado}
          registro={registro}
          onDescargarRegistro={onDescargarRegistro}
        />
      )}

      {histRut && histItems && (
        <HistorialDrawer rut={histRut} items={histItems} onClose={() => setHistRut(null)} />
      )}
    </div>
  );
}

function mapPatchOptimista(patch: Record<string, unknown>): Partial<Caso> {
  const out: Partial<Caso> = {};
  if (typeof patch.motivo === 'string') {
    out.motivo = patch.motivo;
    out.entradaReal = '';
    out.salidaReal = '';
  }
  if (typeof patch.entradaReal === 'string') out.entradaReal = patch.entradaReal;
  if (typeof patch.salidaReal === 'string') out.salidaReal = patch.salidaReal;
  if (typeof patch.obs === 'string') out.obs = patch.obs;
  if (patch.limpiar) {
    out.motivo = '';
    out.entradaReal = '';
    out.salidaReal = '';
    out.obs = '';
  }
  return out;
}

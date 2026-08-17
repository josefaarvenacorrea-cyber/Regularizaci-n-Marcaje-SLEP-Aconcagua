// Campos derivados para pintar un caso en la bandeja / revisión rápida —
// puerto de `filaBase()` en el prototipo original. Se ejecuta en el cliente
// para feedback instantáneo; el servidor recalcula `completa` de forma
// autoritativa en cada PATCH.
import type { Caso } from './casos';
import {
  completa as calcCompleta,
  diaSemana,
  fechaLarga,
  fmtFecha,
  horaHabilitada as calcHoraHabilitada,
  marcas,
  motivosDe,
  pide,
  tagClass,
} from './reglas';

export function casoDisplay(c: Caso, horaSoloOlvido: boolean, esAdmin: boolean) {
  const motivos = motivosDe(c.tipo);
  const m = motivos.find((x) => x.v === c.motivo);
  const p = pide(c.tipo);
  const estado = { tipo: c.tipo, motivo: c.motivo, entradaReal: c.entradaReal, salidaReal: c.salidaReal, obs: c.obs, entro: c.entro, salio: c.salio };
  const hab = calcHoraHabilitada(estado, horaSoloOlvido);
  const mk = marcas(c.tipo, c.entro, c.salio);
  const completa = calcCompleta(estado, horaSoloOlvido);
  const faltaObs = !!(m && m.obs && !String(c.obs || '').trim());
  const faltaMarca = !!(m && m.requiereMarca && mk.e === 'sin marca');

  return {
    id: c.id,
    nombre: c.nombre,
    rut: c.rutFmt || c.rut,
    unidad: c.unidad,
    cargo: c.cargo,
    tipo: c.tipo,
    contexto: esAdmin ? (c.jefatura === null ? 'RUT no está en la dotación' : c.jefatura || 'Sin jefatura registrada') : '',
    turno: c.turno,
    turnoHora: (String(c.turno).match(/\d{2}:\d{2}/) || ['—'])[0],
    fechaFmt: fmtFecha(c.fecha),
    diaSem: diaSemana(c.fecha),
    fechaLarga: fechaLarga(c.fecha),
    tagClass: tagClass(c.tipo),
    marcaEntrada: mk.e,
    marcaSalida: mk.s,
    motivos: [{ v: '', label: 'Seleccionar motivo…' }].concat(motivos.map((x) => ({ v: x.v, label: x.v }))),
    motivo: c.motivo,
    obs: c.obs,
    entradaReal: c.entradaReal,
    salidaReal: c.salidaReal,
    respaldo: c.respaldo,
    horaHabilitada: hab,
    horaBloqueada: !!m && !hab,
    pideEntrada: hab && p.e,
    pideSalida: hab && p.s,
    tituloHora: p.e && p.s ? 'Horas reales de la jornada' : p.e ? 'Hora real en que llegó' : 'Hora real en que se fue',
    bordeEntrada: hab && p.e && !c.entradaReal,
    bordeSalida: hab && p.s && !c.salidaReal,
    bordeObs: faltaObs,
    placeholderObs: m && m.obs ? 'Obligatorio para este motivo' : 'Opcional',
    labelObs: m && m.obs ? 'Observación (obligatoria para este motivo)' : 'Observación (opcional)',
    completa,
    noCompleta: !completa,
    confirmada: c.confirmada,
    listaParaEnviar: completa && !c.confirmada,
    estadoLabel: c.confirmada ? 'Justificada' : completa ? 'Lista para enviar' : c.motivo ? 'Incompleta' : 'Pendiente',
    estadoClass: c.confirmada ? 'tag-accent' : completa ? 'tag-neutral' : 'tag-outline',
    labelRespaldo: c.respaldo ? '📎 ' + c.respaldo : 'Adjuntar respaldo',
    aviso: !completa && c.motivo
      ? faltaMarca
        ? 'Este motivo no es válido sin una marca de entrada real: no puede usarse cuando no hay ninguna marca registrada.'
        : faltaObs
          ? 'Falta la observación obligatoria de este motivo.'
          : 'Registre la hora real de la marca faltante para continuar.'
      : '',
  };
}

export type CasoDisplay = ReturnType<typeof casoDisplay>;

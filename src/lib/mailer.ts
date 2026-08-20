// Notificaciones por correo cuando se justifica un caso. En vez de mandar
// los correos directamente (lo que exigiría credenciales SMTP del tenant de
// Microsoft 365, o verificar el dominio institucional en un servicio
// externo — ninguna de las dos disponible aquí), esta app solo avisa a un
// flujo de Power Automate vía webhook; el flujo manda los correos usando la
// cuenta de Microsoft de quien lo creó (igual que ya se hace para los
// informes de desempeño). Si POWER_AUTOMATE_WEBHOOK_URL no está definida,
// esto es no-op — el resto de la app sigue funcionando igual.
import type { Caso } from './casos';
import { fmtFecha } from './reglas';

// Campos sueltos en vez de una lista de adjuntos: como el flujo de Power
// Automate lo arma la propia administradora en la interfaz de Power Automate
// (sin poder programar), un campo plano se puede arrastrar directo al cuadro
// de "Datos adjuntos" — una lista la obligaría a indexar con una expresión,
// algo mucho más difícil de armar a mano ahí. Esta app nunca manda más de un
// adjunto por correo de todos modos.
type Destinatario = {
  correo: string;
  asunto: string;
  cuerpoHtml: string;
  adjuntoNombre?: string;
  adjuntoContenidoBase64?: string;
};

// POST único al webhook de Power Automate con la lista completa de
// destinatarios; el flujo del lado de Power Automate recorre `destinatarios`
// con un "Apply to each" + "Send an email (V2)" por cada uno (usando
// `adjuntoNombre`/`adjuntoContenidoBase64` si vienen, para el campo Datos
// adjuntos de esa acción). Devuelve
// cuántos destinatarios se intentó notificar, para que quien llama pueda
// distinguir "no había nada que mandar" de "no está configurado el webhook".
async function enviarDestinatarios(destinatarios: Destinatario[]): Promise<number> {
  const webhookUrl = process.env.POWER_AUTOMATE_WEBHOOK_URL;
  if (!webhookUrl || !destinatarios.length) return 0;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinatarios }),
    });
    if (!res.ok) {
      console.error('Power Automate webhook error', res.status, await res.text().catch(() => ''));
      return 0;
    }
  } catch (e) {
    // Un correo que falla no debe romper el guardado del caso.
    console.error('No se pudo avisar al flujo de Power Automate', e);
    return 0;
  }
  return destinatarios.length;
}

function plantillaFuncionario(caso: Caso): Omit<Destinatario, 'correo'> {
  return {
    asunto: `Se regularizó tu inconsistencia de marcaje del ${fmtFecha(caso.fecha)}`,
    cuerpoHtml: `
      <p>Hola ${caso.nombre},</p>
      <p>Tu jefatura registró la justificación de una inconsistencia de marcaje:</p>
      <ul>
        <li><strong>Fecha:</strong> ${fmtFecha(caso.fecha)}</li>
        <li><strong>Tipo:</strong> ${caso.tipo}</li>
        <li><strong>Motivo:</strong> ${caso.motivo}</li>
        ${caso.obs ? `<li><strong>Observación:</strong> ${caso.obs}</li>` : ''}
      </ul>
      <p>Si algo de esto no corresponde, contacta a tu jefatura o a Gestión de Personas.</p>
    `,
  };
}

function plantillaJefatura(caso: Caso, jefaturaNombre: string): Omit<Destinatario, 'correo'> {
  return {
    asunto: `Confirmación: justificaste la inconsistencia de ${caso.nombre} del ${fmtFecha(caso.fecha)}`,
    cuerpoHtml: `
      <p>Hola ${jefaturaNombre},</p>
      <p>Queda registrado que justificaste la siguiente inconsistencia de marcaje:</p>
      <ul>
        <li><strong>Funcionario:</strong> ${caso.nombre} (${caso.rutFmt || caso.rut})</li>
        <li><strong>Fecha:</strong> ${fmtFecha(caso.fecha)}</li>
        <li><strong>Tipo:</strong> ${caso.tipo}</li>
        <li><strong>Motivo:</strong> ${caso.motivo}</li>
        ${caso.obs ? `<li><strong>Observación:</strong> ${caso.obs}</li>` : ''}
      </ul>
    `,
  };
}

function plantillaAdmin(caso: Caso, jefaturaNombre: string): Omit<Destinatario, 'correo'> {
  return {
    asunto: `Justificación registrada: ${caso.nombre} · ${fmtFecha(caso.fecha)}`,
    cuerpoHtml: `
      <p>${jefaturaNombre} justificó una inconsistencia de marcaje:</p>
      <ul>
        <li><strong>Funcionario:</strong> ${caso.nombre} (${caso.rutFmt || caso.rut})</li>
        <li><strong>Unidad:</strong> ${caso.unidad}</li>
        <li><strong>Fecha:</strong> ${fmtFecha(caso.fecha)}</li>
        <li><strong>Tipo:</strong> ${caso.tipo}</li>
        <li><strong>Motivo:</strong> ${caso.motivo}</li>
        ${caso.obs ? `<li><strong>Observación:</strong> ${caso.obs}</li>` : ''}
      </ul>
    `,
  };
}

export type DestinatariosJustificacion = {
  funcionarioCorreo?: string;
  jefaturaCorreo?: string;
  jefaturaNombre: string;
  adminCorreos: string[];
};

// Arma la lista de destinatarios (deduplicada por correo) y la manda en un
// solo POST al webhook de Power Automate.
export async function notificarJustificacion(caso: Caso, dest: DestinatariosJustificacion): Promise<void> {
  const vistos = new Set<string>();
  const destinatarios: Destinatario[] = [];
  const agregar = (correo: string | undefined, plantilla: Omit<Destinatario, 'correo'>) => {
    if (!correo) return;
    const k = correo.trim().toLowerCase();
    if (!k || vistos.has(k)) return;
    vistos.add(k);
    destinatarios.push({ correo, ...plantilla });
  };

  agregar(dest.funcionarioCorreo, plantillaFuncionario(caso));
  agregar(dest.jefaturaCorreo, plantillaJefatura(caso, dest.jefaturaNombre));
  for (const c of dest.adminCorreos) agregar(c, plantillaAdmin(caso, dest.jefaturaNombre));

  await enviarDestinatarios(destinatarios);
}

export type JefaturaPendiente = { nombre: string; correo: string; pendientes: number };

function plantillaRecordatorio(j: JefaturaPendiente, plazoTexto: string, periodo: string): Omit<Destinatario, 'correo'> {
  return {
    asunto: `Recordatorio: inconsistencias de marcaje pendientes · ${periodo}`,
    cuerpoHtml: `
      <p>Hola ${j.nombre},</p>
      <p>Su equipo tiene <strong>${j.pendientes}</strong> ${j.pendientes === 1 ? 'inconsistencia de marcaje pendiente' : 'inconsistencias de marcaje pendientes'} de justificar en el período ${periodo}.</p>
      <p>Por favor ingrese a la aplicación de Regularización de Marcajes antes del <strong>${plazoTexto}</strong> para completarlas.</p>
    `,
  };
}

// Recordatorio de plazo a cada jefatura con casos sin justificar. Devuelve
// cuántas jefaturas se notificó, para que la ruta de API pueda mostrarle a
// quien administra un número real en vez de una simulación.
export async function notificarRecordatorioPlazo(jefaturas: JefaturaPendiente[], plazoTexto: string, periodo: string): Promise<number> {
  const vistos = new Set<string>();
  const destinatarios: Destinatario[] = [];
  for (const j of jefaturas) {
    if (!j.correo) continue;
    const k = j.correo.trim().toLowerCase();
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    destinatarios.push({ correo: j.correo, ...plantillaRecordatorio(j, plazoTexto, periodo) });
  }
  return enviarDestinatarios(destinatarios);
}

export type CierreJefaturaParams = {
  jefaturaNombre: string;
  adminCorreos: string[];
  periodo: string;
  casos: Caso[];
  excelBuffer: Buffer;
  nombreArchivo: string;
};

function plantillaCierre(p: CierreJefaturaParams): Omit<Destinatario, 'correo'> {
  const filas = p.casos
    .map((c) => `<li>${c.nombre} (${c.rutFmt || c.rut}) — ${fmtFecha(c.fecha)} — ${c.tipo} — ${c.motivo}</li>`)
    .join('');
  return {
    asunto: `Cierre de regularización · ${p.jefaturaNombre} · ${p.periodo}`,
    cuerpoHtml: `
      <p>${p.jefaturaNombre} declaró el cierre de la regularización de marcajes del período ${p.periodo}, con ${p.casos.length} ${p.casos.length === 1 ? 'caso regularizado' : 'casos regularizados'}:</p>
      <ul>${filas}</ul>
      <p>El Excel con el detalle va adjunto.</p>
    `,
  };
}

// Cierre formal de una jefatura: correo a Gestión de Personas con el resumen
// de lo regularizado y el Excel adjunto (además de los avisos automáticos
// que ya salieron caso por caso al momento de cada "Enviar").
export async function notificarCierreJefatura(p: CierreJefaturaParams): Promise<number> {
  const vistos = new Set<string>();
  const destinatarios: Destinatario[] = [];
  const adjuntoContenidoBase64 = p.excelBuffer.toString('base64');
  for (const correo of p.adminCorreos) {
    if (!correo) continue;
    const k = correo.trim().toLowerCase();
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    destinatarios.push({ correo, ...plantillaCierre(p), adjuntoNombre: p.nombreArchivo, adjuntoContenidoBase64 });
  }
  return enviarDestinatarios(destinatarios);
}

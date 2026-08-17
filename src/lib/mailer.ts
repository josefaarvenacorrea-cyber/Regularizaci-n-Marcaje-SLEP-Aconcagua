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

type Destinatario = { correo: string; asunto: string; cuerpoHtml: string };

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
// solo POST al webhook de Power Automate. El flujo del lado de Power
// Automate recorre `destinatarios` con un "Apply to each" + "Send an email
// (V2)" por cada uno.
export async function notificarJustificacion(caso: Caso, dest: DestinatariosJustificacion): Promise<void> {
  const webhookUrl = process.env.POWER_AUTOMATE_WEBHOOK_URL;
  if (!webhookUrl) return;

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

  if (!destinatarios.length) return;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinatarios }),
    });
    if (!res.ok) {
      console.error('Power Automate webhook error', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    // Un correo que falla no debe romper el guardado del caso.
    console.error('No se pudo avisar al flujo de Power Automate', e);
  }
}

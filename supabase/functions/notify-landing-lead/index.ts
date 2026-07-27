function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendEmail(payload: Record<string, unknown>) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('Falta RESEND_API_KEY.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend respondió ${response.status}: ${detail}`);
  }
}

Deno.serve(async request => {
  if (request.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  const expectedSecret = Deno.env.get('LANDING_WEBHOOK_SECRET');
  const receivedSecret = request.headers.get('x-inventiq-webhook-secret');
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const webhook = await request.json();
    const lead = webhook?.record ?? webhook;

    const notificationEmail = Deno.env.get('INVENTIQ_NOTIFICATION_EMAIL') || 'inventiqweb@gmail.com';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
    if (!fromEmail) throw new Error('Falta RESEND_FROM_EMAIL.');

    const subject = `Nueva solicitud InventIQ · ${lead.business_name || 'Negocio por definir'}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#10233f">
        <h2 style="color:#071a33">Nueva solicitud desde la landing de InventIQ</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(lead.full_name)}</p>
        <p><strong>Negocio:</strong> ${escapeHtml(lead.business_name)}</p>
        <p><strong>WhatsApp:</strong> ${escapeHtml(lead.whatsapp)}</p>
        <p><strong>Correo:</strong> ${escapeHtml(lead.email || 'No registrado')}</p>
        <p><strong>Tipo de negocio:</strong> ${escapeHtml(lead.business_type)}</p>
        <p><strong>Plan:</strong> ${escapeHtml(lead.plan_code)}</p>
        <p><strong>Contacto preferido:</strong> ${escapeHtml(lead.preferred_contact)}</p>
        <p><strong>Mensaje:</strong><br>${escapeHtml(lead.message || 'Sin mensaje adicional')}</p>
      </div>
    `;

    await sendEmail({
      from: fromEmail,
      to: [notificationEmail],
      subject,
      html,
      reply_to: lead.email || undefined,
    });

    if (lead.email) {
      await sendEmail({
        from: fromEmail,
        to: [lead.email],
        subject: 'Recibimos tu solicitud de InventIQ',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#10233f">
            <h2 style="color:#071a33">Solicitud recibida</h2>
            <p>Gracias por comunicarte con InventIQ.</p>
            <p>Revisaremos la información de tu negocio y nos comunicaremos por el medio seleccionado.</p>
            <p>Este mensaje confirma la recepción de la solicitud y no genera ningún cobro ni compromiso de contratación.</p>
          </div>
        `,
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 },
    );
  }
});

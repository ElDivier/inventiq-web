# Notificaciones por correo de solicitudes

Esta función es opcional. Envía:

1. Una notificación a `inventiqweb@gmail.com`.
2. Una confirmación al interesado cuando proporcionó correo.

## Requiere

- Una cuenta de Resend o un proveedor equivalente.
- Un dominio/correo remitente verificado.
- Desplegar la función `notify-landing-lead`.
- Configurar estos secretos en Supabase:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `INVENTIQ_NOTIFICATION_EMAIL=inventiqweb@gmail.com`
  - `LANDING_WEBHOOK_SECRET`
- Crear un Database Webhook para INSERT en `public.landing_leads`.
- URL: `https://TU-PROJECT-REF.supabase.co/functions/v1/notify-landing-lead`
- Encabezado: `x-inventiq-webhook-secret` con el mismo valor del secreto.

No coloques la clave de Resend dentro de `.env.local` del navegador.

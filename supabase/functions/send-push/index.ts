// ─────────────────────────────────────────────────────────
// send-push Edge Function
// Llama pg_cron cada minuto para enviar notificaciones push
// de los recordatorios cuyo alarm_ts esté llegando.
// Protegido con x-cron-secret (no requiere JWT de usuario).
// ─────────────────────────────────────────────────────────
import webpush from 'npm:web-push@3';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  // Seguridad: sólo pg_cron puede llamar esta función
  const secret = req.headers.get('x-cron-secret');
  if (secret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Obtiene claves VAPID
  const { data: configs } = await admin
    .from('app_config')
    .select('key, value')
    .in('key', ['vapid_public_key', 'vapid_private_key']);

  if (!configs || configs.length < 2) {
    return new Response(JSON.stringify({ error: 'VAPID keys not found. Call setup-push first.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const vapidPublic  = configs.find((c: any) => c.key === 'vapid_public_key')!.value;
  const vapidPrivate = configs.find((c: any) => c.key === 'vapid_private_key')!.value;

  webpush.setVapidDetails(
    'mailto:lana@maulio-and-lana.vercel.app',
    vapidPublic,
    vapidPrivate
  );

  // Obtiene recordatorios cuyo alarm_ts está en el próximo minuto
  const { data: due, error } = await admin.rpc('get_due_reminders');

  if (error) {
    console.error('get_due_reminders error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No due reminders' }));
  }

  let sent = 0;
  const errors: string[] = [];

  for (const item of due) {
    try {
      const alarmMin = item.alarm_offset || 0;
      const body = alarmMin > 0
        ? `Empieza en ${alarmMin} min · ${item.start_time}`
        : `Empieza ahora · ${item.start_time}`;

      await webpush.sendNotification(
        item.subscription,
        JSON.stringify({
          title: `⏰ ${item.title}`,
          body:  body,
          tag:   `lana-${item.id}`,
          url:   'https://maulio-and-lana.vercel.app'
        })
      );
      sent++;
    } catch (e: any) {
      const msg = `${item.id}: ${e.message}`;
      errors.push(msg);
      console.error('Push error', msg);

      // Si la suscripción caducó (HTTP 410), la eliminamos
      if (e.statusCode === 410) {
        await admin
          .from('push_subscriptions')
          .delete()
          .eq('subscription', item.subscription);
      }
    }
  }

  return new Response(
    JSON.stringify({ sent, total: due.length, errors }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

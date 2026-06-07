// ─────────────────────────────────────────────────────────
// setup-push Edge Function
// Genera claves VAPID (si no existen) y devuelve la clave pública.
// Requiere JWT de usuario autenticado.
// ─────────────────────────────────────────────────────────
import webpush from 'npm:web-push@3';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Comprueba si ya existen las claves
  const { data: rows } = await admin
    .from('app_config')
    .select('key, value')
    .in('key', ['vapid_public_key', 'vapid_private_key']);

  let publicKey: string;

  if (rows && rows.length === 2) {
    publicKey = rows.find((r: any) => r.key === 'vapid_public_key')!.value;
  } else {
    // Genera nuevas claves VAPID
    const vapidKeys = webpush.generateVAPIDKeys();
    await admin.from('app_config').upsert([
      { key: 'vapid_public_key',  value: vapidKeys.publicKey  },
      { key: 'vapid_private_key', value: vapidKeys.privateKey },
    ]);
    publicKey = vapidKeys.publicKey;
  }

  return new Response(
    JSON.stringify({ publicKey }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

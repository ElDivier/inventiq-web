import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeError(error: unknown, fallback = 'No se pudo procesar la solicitud.') {
  const message = error instanceof Error ? error.message : String((error as any)?.message || fallback);
  return message || fallback;
}

function randomSecret(length = 48) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => (value % 36).toString(36)).join('');
}

function employeeEmail(staffId: string) {
  const compactStaffId = staffId.replace(/-/g, '').slice(0, 20);
  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `staff-${compactStaffId}-${nonce}@inventiqweb.com`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ ok: false, error: 'La función de empleados no está configurada en Supabase.' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toLowerCase();
    const accessCode = String(body?.accessCode || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!accessCode || !password) {
      return json({ ok: false, error: 'Ingresa el código del negocio y la contraseña de acceso.' });
    }

    if (action === 'lookup') {
      const { data, error } = await admin.rpc('restaurant_employee_lookup', {
        p_access_code: accessCode,
        p_password: password,
      });

      if (error) return json({ ok: false, error: error.message || 'Código o contraseña incorrectos.' });

      return json({
        ok: true,
        storeName: data?.storeName || '',
        businessType: data?.businessType || 'restaurante',
        businessTypeLabel: data?.businessTypeLabel || 'Restaurante',
        profiles: Array.isArray(data?.profiles) ? data.profiles : [],
      });
    }

    if (action !== 'login') {
      return json({ ok: false, error: 'Acción no válida.' });
    }

    const profileId = String(body?.profileId || '').trim();
    const pin = String(body?.pin || '').trim();
    if (!profileId || !/^\d{4,6}$/.test(pin)) {
      return json({ ok: false, error: 'Selecciona tu perfil e ingresa un PIN válido.' });
    }

    const { data: verified, error: verifyError } = await admin.rpc('restaurant_employee_verify_profile', {
      p_access_code: accessCode,
      p_password: password,
      p_profile_id: profileId,
      p_pin: pin,
    });

    if (verifyError || !verified?.ownerId || !verified?.profile?.id) {
      return json({ ok: false, error: verifyError?.message || 'No se pudo validar el perfil del empleado.' });
    }

    const ownerId = String(verified.ownerId);
    const staff = verified.profile;
    const metadata = {
      inventiq_employee_session: true,
      inventiq_owner_id: ownerId,
      inventiq_staff_profile_id: staff.id,
      inventiq_staff_role: staff.role,
    };

    const { data: existingMap, error: mapReadError } = await admin
      .from('restaurant_staff_auth_users')
      .select('staff_profile_id, owner_user_id, auth_user_id, auth_email, is_active')
      .eq('staff_profile_id', staff.id)
      .maybeSingle();

    if (mapReadError) {
      return json({ ok: false, error: `No se pudo leer la identidad operativa: ${mapReadError.message}` });
    }

    async function createIdentity() {
      const loginSecret = randomSecret(56);
      const authEmail = employeeEmail(staff.id);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: authEmail,
        password: loginSecret,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (createError || !created?.user?.id) {
        throw new Error(`No se pudo crear la identidad del empleado: ${createError?.message || 'respuesta incompleta de Supabase Auth'}`);
      }

      return { authUserId: created.user.id, authEmail, loginSecret, createdNow: true };
    }

    async function updateExistingIdentity(authUserId: string, authEmail: string) {
      const loginSecret = randomSecret(56);
      const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
        password: loginSecret,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (updateError) throw updateError;
      return { authUserId, authEmail, loginSecret, createdNow: false };
    }

    let identity;
    if (existingMap?.auth_user_id && existingMap?.auth_email) {
      try {
        identity = await updateExistingIdentity(existingMap.auth_user_id, existingMap.auth_email);
      } catch (error) {
        console.warn('Identidad operativa anterior inválida; se creará una nueva.', safeError(error));
        identity = await createIdentity();
      }
    } else {
      identity = await createIdentity();
    }

    async function persistIdentity(currentIdentity: typeof identity) {
      const { error: mapWriteError } = await admin
        .from('restaurant_staff_auth_users')
        .upsert({
          staff_profile_id: staff.id,
          owner_user_id: ownerId,
          auth_user_id: currentIdentity.authUserId,
          auth_email: currentIdentity.authEmail,
          is_active: true,
          last_login_at: new Date().toISOString(),
        }, { onConflict: 'staff_profile_id' });

      if (mapWriteError) {
        throw new Error(`No se pudo vincular la sesión del empleado: ${mapWriteError.message}`);
      }
    }

    await persistIdentity(identity);

    async function signInIdentity(currentIdentity: typeof identity) {
      return authClient.auth.signInWithPassword({
        email: currentIdentity.authEmail,
        password: currentIdentity.loginSecret,
      });
    }

    let { data: loginData, error: loginError } = await signInIdentity(identity);

    // Autorreparación: si una identidad antigua quedó dañada o fue creada con un
    // correo que Auth ya no acepta, se reemplaza por una identidad nueva una vez.
    if (loginError || !loginData?.session) {
      console.warn('Primer inicio de sesión operativo falló; se regenerará la identidad.', loginError?.message || 'sin sesión');
      const staleAuthUserId = identity.authUserId;
      identity = await createIdentity();
      await persistIdentity(identity);
      ({ data: loginData, error: loginError } = await signInIdentity(identity));

      if (!loginError && loginData?.session && staleAuthUserId && staleAuthUserId !== identity.authUserId) {
        await admin.auth.admin.deleteUser(staleAuthUserId).catch(() => null);
      }
    }

    if (loginError || !loginData?.session) {
      return json({
        ok: false,
        error: `Supabase no pudo abrir la sesión operativa: ${loginError?.message || 'no se recibió una sesión'}`,
      });
    }

    const { data: ownerProfile, error: ownerProfileError } = await admin
      .from('profiles')
      .select('id, owner_name, store_name, city, business_id, address, phone, commercial_email, receipt_footer, logo_url, business_type, plan, subscription_status, subscription_start, subscription_end, is_suspended, max_products, split_payment_enabled, customer_accounts_enabled')
      .eq('id', ownerId)
      .maybeSingle();

    if (ownerProfileError || !ownerProfile) {
      return json({ ok: false, error: `No se pudo cargar la información del negocio: ${ownerProfileError?.message || 'perfil no encontrado'}` });
    }

    const { error: auditError } = await admin.from('restaurant_audit_log').insert({
      user_id: ownerId,
      staff_profile_id: staff.id,
      operator_name: staff.name,
      operator_role: staff.role,
      action: 'employee.portal_login',
      entity_type: 'staff_profile',
      entity_id: staff.id,
      details: { access: 'employee_portal' },
    });
    if (auditError) console.warn('No se pudo registrar auditoría de login:', auditError.message);

    return json({
      ok: true,
      storeName: verified.storeName || ownerProfile.store_name || '',
      businessType: verified.businessType || ownerProfile.business_type || 'restaurante',
      operator: staff,
      userId: identity.authUserId,
      context: {
        ownerId: ownerProfile.id,
        ownerName: ownerProfile.owner_name || '',
        storeName: ownerProfile.store_name || verified.storeName || '',
        city: ownerProfile.city || '',
        businessId: ownerProfile.business_id || '',
        address: ownerProfile.address || '',
        phone: ownerProfile.phone || '',
        commercialEmail: ownerProfile.commercial_email || '',
        receiptFooter: ownerProfile.receipt_footer || 'Gracias por su compra.',
        logoUrl: ownerProfile.logo_url || '',
        businessType: ownerProfile.business_type || verified.businessType || 'restaurante',
        plan: ownerProfile.plan || 'anual',
        subscriptionStatus: ownerProfile.subscription_status || 'activo',
        subscriptionStart: ownerProfile.subscription_start || '',
        subscriptionEnd: ownerProfile.subscription_end || '',
        isSuspended: Boolean(ownerProfile.is_suspended),
        maxProducts: Number(ownerProfile.max_products || 2000),
        splitPaymentEnabled: Boolean(ownerProfile.split_payment_enabled),
        customerAccountsEnabled: Boolean(ownerProfile.customer_accounts_enabled),
        operator: staff,
      },
      session: {
        access_token: loginData.session.access_token,
        refresh_token: loginData.session.refresh_token,
        expires_in: loginData.session.expires_in,
      },
    });
  } catch (error) {
    console.error('restaurant-employee-auth:', error);
    return json({ ok: false, error: safeError(error) });
  }
});

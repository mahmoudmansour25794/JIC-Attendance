// Dependencies are injected so the actual authentication handler is testable.
export function makeLoginHandler({ admin, authClient, hash, delay }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  const reply = (status, body) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  const invalid = () => reply(401, { error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
    // Limit the actual bytes, including requests without Content-Length.
    const reader = req.body?.getReader();
    if (!reader) return reply(400, { error: 'Invalid request' });
    let raw = ''; let bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8192) { await reader.cancel(); return reply(413, { error: 'Request too large' }); }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
      const body = JSON.parse(raw);
      if (typeof body?.username !== 'string' || typeof body?.password !== 'string') return invalid();
      const username = body.username.trim().toLowerCase();
      const password = body.password;
      if (!/^[a-z0-9_]{3,32}$/.test(username) || !password || password.length > 1024) return invalid();
      // x-forwarded-for is supplied by the gateway; the username limit also
      // applies independently so changing a client IP cannot bypass it.
      const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown').slice(0,128);
      for (const [key, limit] of [[`ip:${ip}`,60], [`username:${username}`,15]]) {
        const { data, error } = await admin.rpc('consume_username_login_attempt', { p_key: await hash(key), p_limit: limit });
        if (error) return reply(503, { error: 'تعذر تسجيل الدخول حاليًا. حاول لاحقًا.' });
        if (!data) return reply(429, { error: 'محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة.' });
      }
      const { data: account, error: lookupError } = await admin.from('app_users').select('user_id').eq('username', username).maybeSingle();
      if (lookupError) return reply(503, { error: 'تعذر تسجيل الدخول حاليًا. حاول لاحقًا.' });
      let email = 'unassigned-username@invalid.invalid';
      if (account) {
        const { data, error } = await admin.auth.admin.getUserById(account.user_id);
        if (error || !data.user?.email) return invalid();
        email = data.user.email;
      }
      // Supabase Auth verifies the existing password. Never log credentials or
      // expose the username/email lookup to the caller before authentication.
      const client = authClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !account || !data.session || data.user?.id !== account.user_id) {
        await delay(250);
        return invalid();
      }
      return reply(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    } catch {
      // Do not reflect upstream errors, emails, passwords or tokens.
      return reply(400, { error: 'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.' });
    }
  };
}

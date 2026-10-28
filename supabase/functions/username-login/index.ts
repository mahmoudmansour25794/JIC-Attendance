import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { makeLoginHandler } from './handler.js';
const url = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, secret, options);
Deno.serve(makeLoginHandler({
  admin,
  authClient: () => createClient(url, anon, options),
  hash: async (value: string) => {
    const bytes = new TextEncoder().encode(`${secret}:${value}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
}));

import { createClient } from '@supabase/supabase-js';

const url = process.env.QA_SUPABASE_URL;
const key = process.env.QA_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Missing QA Supabase configuration');

const email = `qa-probe-${Date.now()}@example.com`;
const password = `QaProbe!${Date.now()}aA9`;
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await supabase.auth.signUp({ email, password });
if (error) throw error;
console.log(JSON.stringify({ userCreated: Boolean(data.user), sessionCreated: Boolean(data.session), emailConfirmationRequired: Boolean(data.user && !data.session) }));
if (!data.session) process.exit(2);

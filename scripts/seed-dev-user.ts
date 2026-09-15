/**
 * Creates or refreshes the fixed local/dev Supabase login.
 *
 * Prerequisites:
 * - Migrations applied
 * - `.env` with EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Processes are not written here — the app library is still in-memory.
 * After sign-in, use __DEV__ "Load demo library" in the app.
 *
 * Usage: npm run seed:dev
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  DEMO_DISPLAY_NAME,
  DEMO_EMAIL,
  DEMO_PASSWORD,
} from '../src/dev/demo-credentials';

function loadEnvFile() {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example → .env and fill it in.`);
  }
  return value;
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  loadEnvFile();

  const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string;

  const created = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });

  if (created.error || !created.data.user) {
    const existingId = await findUserIdByEmail(admin, DEMO_EMAIL);
    if (!existingId) {
      throw new Error(
        `Could not create or find demo user: ${created.error?.message ?? 'unknown error'}`,
      );
    }
    userId = existingId;
    const updated = await admin.auth.admin.updateUserById(existingId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (updated.error) {
      throw new Error(`Failed to refresh demo user password: ${updated.error.message}`);
    }
    console.log(`Updated existing user ${DEMO_EMAIL}`);
  } else {
    userId = created.data.user.id;
    console.log(`Created user ${DEMO_EMAIL}`);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ display_name: DEMO_DISPLAY_NAME })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to set display_name: ${profileError.message}`);
  }

  console.log('');
  console.log('Demo login ready:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  name:     ${DEMO_DISPLAY_NAME}`);
  console.log('');
  console.log(
    'Processes are still in-memory in the app. After sign-in, tap "Load demo library" (__DEV__).',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

// One-off: create the HR Manager Supabase Auth user.
//
//   pnpm --filter @acme/api create-hr-user
//
// Requires the Supabase service-role key (NOT the anon key) in the env:
//
//   SUPABASE_SERVICE_ROLE_KEY   Supabase -> Settings -> API -> service_role
//
// Optional overrides:
//
//   HR_EMAIL                    default: hr@acme.test
//   HR_PASSWORD                 default: AcmeHR-2026!
//
// Idempotent: if the user already exists, the script updates the
// password instead of failing.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.HR_EMAIL ?? 'hr@acme.test';
const password = process.env.HR_PASSWORD ?? 'AcmeHR-2026!';

if (!url) {
  console.error('SUPABASE_URL is not set in apps/api/.env');
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY is not set in apps/api/.env.\n' +
      'Get it from Supabase dashboard -> Settings -> API -> service_role secret.',
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail: string) {
  // Page through users until we find a match. listUsers is paginated
  // (50 per page by default), but the HR app has at most a few users
  // so a small loop is fine.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === targetEmail);
    if (hit) return hit;
    if (data.users.length < 50) return null;
    page++;
    if (page > 20) throw new Error('listUsers paged past 1000 entries; bailing');
  }
}

async function main() {
  console.log(`Looking for existing user ${email}…`);
  const existing = await findUserByEmail(email);

  if (existing) {
    console.log(`User exists (id=${existing.id}). Updating password…`);
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    console.log('Creating user…');
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip the "click the email" step
    });
    if (error) throw error;
  }

  console.log('\n=== HR Manager credentials ===');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log('==============================\n');
  console.log('Sign in at http://localhost:5173/login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

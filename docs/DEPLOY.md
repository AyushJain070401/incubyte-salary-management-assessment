# Deploy

The application has three production-time services:

| Component | Provider | Cost |
|---|---|---|
| Database + Auth | [Supabase](https://supabase.com) | Free tier |
| API (`apps/api`) | [Render](https://render.com) | Free tier |
| Web (`apps/web`) | [Vercel](https://vercel.com) | Free tier |

You should already have a Supabase project from local development. The steps below set up the Render and Vercel pieces so the deployed web app talks to the same Supabase that local dev does.

## 1. Push to GitHub

```bash
gh repo create acme-salary-management --public --source . --push
```

Or push to an existing remote. Render and Vercel both connect to GitHub directly.

## 2. Deploy the API to Render

1. Sign in at https://render.com and click **New → Blueprint**.
2. Connect your GitHub account and pick this repository.
3. Render detects [`render.yaml`](../render.yaml) and offers to create `acme-salary-api`. Accept.
4. Before the first deploy, set the four secret env vars in the Render dashboard:

   | Var | Where to find |
   |---|---|
   | `DATABASE_URL` | Supabase → Settings → Database → Direct connection string |
   | `SUPABASE_URL` | Supabase → Settings → API → Project URL |
   | `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT secret |
   | `CORS_ORIGINS` | Leave empty for now; we'll set it after the Vercel deploy gives us a URL |

5. Click **Apply**. The first build takes ~3 minutes.
6. Once green, note the service URL (e.g. `https://acme-salary-api.onrender.com`). Visit `/health` to confirm — should return `{"status":"ok",...}`.

## 3. Deploy the web frontend to Vercel

1. Sign in at https://vercel.com and click **Add New → Project**.
2. Import the same GitHub repository.
3. In the Vercel project configuration:
   - **Root Directory**: `apps/web`
   - **Framework**: detected as Vite (auto-filled from [`apps/web/vercel.json`](../apps/web/vercel.json))
   - **Install/Build commands**: from `vercel.json`, no override needed
4. Set environment variables:

   | Var | Value |
   |---|---|
   | `VITE_API_URL` | Your Render URL from step 2 (e.g. `https://acme-salary-api.onrender.com`) |
   | `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` from step 2 |
   | `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` key |

5. Click **Deploy**. ~1 minute.
6. Note the Vercel URL (e.g. `https://acme-salary-management.vercel.app`).

## 4. Wire CORS

1. Back in the Render dashboard for the API service, set:
   `CORS_ORIGINS = https://acme-salary-management.vercel.app`
   (or whatever your Vercel URL is — comma-separate multiple).
2. Render redeploys automatically. After ~1 minute, the SPA can reach the API.

## 5. Create the HR Manager account

Supabase doesn't have a sign-up page wired into the SPA (single-role app). Create the user once:

1. Supabase dashboard → **Authentication → Users → Add user**.
2. Enter email + password. Confirm.
3. Sign in at the Vercel URL with those credentials.

## 6. Apply migrations to the deployed DB

You already ran `pnpm db:migrate` against your Supabase project locally, so the schema is in place. If you spun up a new Supabase project for production:

```bash
DATABASE_URL='<the production URL>' pnpm --filter @acme/api db:deploy
DATABASE_URL='<the production URL>' pnpm --filter @acme/api seed   # optional — 10k demo employees
```

## 7. Smoke test the live stack

- Visit `https://<your-vercel-url>/` — placeholder → redirects to `/login`
- Sign in
- Open Employees → search works, currency switcher works, sort by salary works
- Open any employee → "Give raise…" → submit → see the new history row land
- Open Analytics → all charts render
- Open Import → click "Load example", confirm dry-run report, commit

## Notes on costs and limits

- **Supabase free tier**: 500MB DB, sufficient for 10k employees + a couple hundred raises. Auto-pauses after 7 days of inactivity (re-deploying the API wakes it back up).
- **Render free tier**: API service sleeps after 15 minutes of inactivity. First request after sleep takes ~30s. Acceptable for a demo.
- **Vercel free tier**: 100GB bandwidth / month. Static SPA, effectively unlimited for a demo.

All three free tiers are sufficient to host this project at the assessment's 10k-employee scale.

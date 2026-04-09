# Deployment Guide

ServiceDesk Pro is deployed entirely on free tiers:

| Component | Provider | Plan |
|---|---|---|
| Backend | Render (Docker web service) | Free |
| Frontend | Vercel | Hobby |
| PostgreSQL | Neon (Frankfurt) | Free |
| Redis | Upstash (Ireland) | Free |
| File storage | Cloudinary | Free |
| Error tracking | Sentry (FE + BE) | Developer |
| Tracing | Honeycomb | Free |
| Uptime keep-alive | UptimeRobot | Free |
| Coverage | Codecov | Free |

> Render free dynos sleep after 15 min of inactivity. UptimeRobot pings every 5 min to keep them warm.

---

## 1. Backend on Render

### 1.1 Create the service

1. Go to **https://dashboard.render.com → New + → Blueprint**.
2. Connect this GitHub repo and pick the `main` branch.
3. Render reads `render.yaml` from the repo root and pre-fills the service.
4. Click **Apply**. The service `service-desk-pro-backend` will start building.

### 1.2 Set secret env vars

On the service → **Environment** tab, fill the variables marked `sync: false` in `render.yaml`. Values live in your local `service-desk-pro-secrets.txt`:

| Variable | Source |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `REDIS_URL` | Upstash `rediss://...` URL |
| `JWT_ACCESS_SECRET` | random 64-char secret |
| `JWT_REFRESH_SECRET` | random 64-char secret (different from access) |
| `CORS_ORIGIN` | `https://service-desk-pro.vercel.app` (set after Vercel deploy) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard |
| `CLOUDINARY_UPLOAD_PRESET` | `service_desk_attachments` |
| `SENTRY_DSN` | Sentry → backend project |
| `OTEL_EXPORTER_OTLP_HEADERS` | `x-honeycomb-team=YOUR_API_KEY` |

Click **Save Changes** — Render redeploys.

### 1.3 Verify the deploy

```
curl https://service-desk-pro-backend.onrender.com/api/v1/health/live
curl https://service-desk-pro-backend.onrender.com/api/v1/health/ready
```

`live` should return immediately. `ready` checks Postgres + Redis. Swagger lives at `/api/docs`.

The Dockerfile runs `npx prisma migrate deploy` on each container start, so schema changes apply automatically.

### 1.4 Seed demo data (one-off)

In Render dashboard → service → **Shell** tab:
```sh
npx prisma db seed
```
This creates the 4 demo users + 4 SLA policies.

---

## 2. Frontend on Vercel

### 2.1 Create the project

1. Go to **https://vercel.com/new → Import Git Repository**.
2. Pick this repo. Vercel detects `frontend/vercel.json`.
3. **Root Directory:** `frontend`
4. **Framework Preset:** Angular (auto-detected)
5. **Build Command:** `npm run build` (from vercel.json)
6. **Output Directory:** `dist/frontend/browser`
7. Click **Deploy**.

### 2.2 Update the backend URL

After the first deploy, copy your Vercel URL (e.g. `https://service-desk-pro.vercel.app`) and:

1. **On Render** → set `CORS_ORIGIN=https://service-desk-pro.vercel.app` and redeploy.
2. **In code**: edit `frontend/src/environments/environment.prod.ts` if your Render URL differs from `service-desk-pro-backend.onrender.com`. Commit + push → Vercel rebuilds.

### 2.3 Verify

Open `https://service-desk-pro.vercel.app/login` → log in with `admin@servicedesk.com / password123`.

---

## 3. UptimeRobot keep-alive

Render free dynos sleep after 15 minutes idle. To keep the backend warm:

1. Sign up at **https://uptimerobot.com**.
2. **+ Add New Monitor**:
   - **Type:** HTTP(s)
   - **Friendly Name:** ServiceDesk BE
   - **URL:** `https://service-desk-pro-backend.onrender.com/api/v1/health/live`
   - **Monitoring Interval:** 5 minutes
3. Save. UptimeRobot will ping every 5 min, preventing the dyno from sleeping.

---

## 4. GitHub Actions secrets

Some workflows in `.github/workflows/` need access to the production database
or other external services. Those are stored as **repository secrets** so they
are never committed and never appear in workflow logs.

### Which secrets the project needs

| Secret | Used by | Where to get it |
|---|---|---|
| `DATABASE_URL` | `seed-reset.yml` | Neon → Connection Details → **Pooled** connection (hostname contains `-pooler`) |
| `DIRECT_URL` | `seed-reset.yml` | Neon → Connection Details → **Direct** connection (hostname WITHOUT `-pooler`) |
| `CODECOV_TOKEN` | `backend-ci.yml`, `frontend-ci.yml` | Codecov → repo settings → upload token |

`e2e.yml` does **not** need any secret — it spins up a local Postgres + Redis
inside the runner via `services:` and uses throwaway in-memory secrets.

### How to add a secret (step-by-step)

1. Open the repo on GitHub: `https://github.com/<your-username>/service-desk-pro`
2. Top tabs → **Settings**
3. Left sidebar → **Security** group → **Secrets and variables** → **Actions**
4. Green button **New repository secret** (top right)
5. Fill the form:
   - **Name:** the exact secret key (case-sensitive), e.g. `DATABASE_URL`
   - **Secret:** paste the value with no surrounding quotes and no trailing whitespace
6. Click **Add secret**

GitHub stores it encrypted. You can never read it back from the UI — only
overwrite (pencil icon → **Update secret**) or delete it. Workflows access it
via `${{ secrets.DATABASE_URL }}`.

### Pulling values from your local `.env`

The values for `DATABASE_URL` and `DIRECT_URL` already live in your local
`backend/.env` (which is gitignored). To copy them into GitHub Secrets without
exposing them in your terminal history:

```bash
# print just the value of DATABASE_URL
grep '^DATABASE_URL=' backend/.env | cut -d= -f2-

# print just the value of DIRECT_URL
grep '^DIRECT_URL=' backend/.env | cut -d= -f2-
```

Run each line, copy the output, paste into GitHub. **Strip surrounding quotes
if your `.env` has them** — GitHub Secrets store the value verbatim.

### Verifying it works

Open the repo → **Actions** tab → click on **Seed reset** in the left sidebar
→ click the green **Run workflow** button (top right) → **Run workflow**.

A new run appears within ~10 seconds. Wait for the `seed` job to finish:

- ✅ **Green check** = secrets are correct, seed ran successfully.
- ❌ **Red X** = open the run, click the `seed` job, expand the `Run seed`
  step, and read the error. The most common mistakes are:
  - Pooled vs direct URL swapped (Prisma migrations need `DIRECT_URL`)
  - Forgot `?sslmode=require` at the end (Neon requires SSL)
  - Pasted URL with surrounding quotes
  - Pasted URL with trailing newline

After fixing, edit the secret (pencil icon) → **Update secret** → re-run the
workflow.

### Daily reset cadence

Once secrets are in place, `seed-reset.yml` runs **automatically every day at
03:00 UTC** via the workflow's `schedule:` trigger. You don't have to do
anything else — the demo accounts and SLA policies will be re-upserted nightly.

---

## 5. Codecov

1. Sign up at **https://codecov.io** with GitHub.
2. Add this repo. Copy the **upload token**.
3. In the repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `CODECOV_TOKEN`
   - Value: paste from Codecov
4. The CI workflow already runs `npm run test:cov` and uploads `coverage/lcov.info` via the codecov action.

---

## 6. Sentry verification

After the first deploy, trigger a test error from the backend (e.g. send a malformed request) and check that it shows up in **Sentry → backend project**. The frontend Sentry SDK is initialized at app bootstrap and captures runtime errors automatically.

---

## 7. Local-equivalent override

If you need to point Vercel preview deployments at a local backend (e.g. for manual testing), set `apiUrl` / `wsUrl` via Vercel **Environment Variables** instead of editing `environment.prod.ts`. This requires reading them in code via `import.meta.env` — out of scope for the current build.

---

## Production checklist

- [ ] Render service `service-desk-pro-backend` created and healthy
- [ ] All `sync: false` env vars filled on Render
- [ ] `npx prisma db seed` ran successfully
- [ ] Vercel project created, build succeeds
- [ ] `CORS_ORIGIN` on Render points at the Vercel URL
- [ ] `environment.prod.ts` apiUrl/wsUrl match the Render URL
- [ ] Login flow works on production
- [ ] Tickets CRUD + comments + status changes work
- [ ] WebSocket connects (open Network tab → look for `/ws/?EIO=4`)
- [ ] UptimeRobot monitor created and shows green
- [ ] Codecov receiving coverage uploads from CI
- [ ] Sentry receiving a sample error from FE + BE

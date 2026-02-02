# Render Deployment Runbook

## Migration-Mode Workflow for Production Database Schema Management

This runbook ensures audit-grade reliability for the Venture Acceleration Platform by using a controlled migration workflow: **Generate locally → Commit → Migrate in Production**.

---

## Prerequisites

### Local Environment
```bash
# Required tools
node -v  # v18+ required
npm -v   # v9+ required
```

### Render Services Required
1. **Web Service** - Node.js application
2. **PostgreSQL Database** - Managed database instance

---

## Initial Setup (One-Time)

### 1. Create Render PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **PostgreSQL**
3. Configure:
   - **Name:** `referral-service-db`
   - **Database:** `referral_service`
   - **User:** `referral_admin`
   - **Region:** Same as your Web Service
   - **Plan:** Starter ($7/mo) or higher for production
4. Copy the **Internal Database URL** (for Web Service)
5. Copy the **External Database URL** (for local migrations)

### 2. Create Render Web Service

1. Click **New** → **Web Service**
2. Connect your GitHub repo: `Jaymayes/https-landing-page-builder-jamarrlmayes.replit.app`
3. Configure:
   - **Name:** `referral-service-ai`
   - **Region:** Same as database
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`

### 3. Configure Environment Variables

In Render Web Service → **Environment**:

```env
# === REQUIRED ===
NODE_ENV=production
DATABASE_URL=<Internal Database URL from Step 1>

# === AI Services ===
OPENAI_API_KEY=sk-...
HEYGEN_API_KEY=...

# === Authentication (Clerk) ===
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
ADMIN_USER_ID=user_...

# === Scheduling (Calendly) ===
CALENDLY_URL=https://calendly.com/your-username/business-upgrade
CALENDLY_VENTURE_URL=https://calendly.com/your-username/venture-fit
CALENDLY_WEBHOOK_SIGNING_KEY=...

# === Notifications ===
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# === Monetization ===
SUCCESS_FEE_CENTS=10000
```

**⚠️ CRITICAL:** Do NOT set `SKIP_AUTH=true` in production.

---

## Migration Workflow

### Phase 1: Generate Migration Locally

```bash
# 1. Set DATABASE_URL to your EXTERNAL Render database URL
#    (Use External URL for local access, Internal URL is for Render services only)
export DATABASE_URL="postgresql://referral_admin:PASSWORD@REGION.render.com:5432/referral_service"

# 2. Generate migration from schema changes
npx drizzle-kit generate

# 3. Review the generated SQL
cat migrations/*.sql

# 4. Commit the migration
git add migrations/
git commit -m "db: Add migration for [describe changes]"
git push origin main
```

### Phase 2: Apply Migration in Production

**Option A: Via Render Shell (Recommended)**

1. Go to Render Dashboard → Web Service → **Shell**
2. Run:
```bash
npx drizzle-kit migrate
```

**Option B: Via Local Terminal with External URL**

```bash
# Use the EXTERNAL Database URL
export DATABASE_URL="postgresql://referral_admin:PASSWORD@REGION.render.com:5432/referral_service"
npx drizzle-kit migrate
```

**Option C: Direct SQL Execution**

1. Go to Render Dashboard → PostgreSQL → **PSQL**
2. Paste and execute the migration SQL directly

### Phase 3: Verify Migration

```bash
# In Render Shell or locally with External URL
npx drizzle-kit studio
```

Or via PSQL:
```sql
\d leads  -- Verify leads table schema
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads';
```

---

## Current Schema Migration (v1.0.0)

If deploying fresh, run this SQL to create the complete schema:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Leads table (Full schema with all v1.0.0 columns)
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Anonymous',
  company TEXT NOT NULL DEFAULT 'Unknown',
  email TEXT NOT NULL DEFAULT '',
  pain_point TEXT NOT NULL,
  -- Business Upgrades qualification
  company_size TEXT,
  budget_confirmed BOOLEAN DEFAULT false,
  lead_type TEXT DEFAULT 'business_upgrade',
  is_high_intent BOOLEAN DEFAULT false,
  -- Status tracking
  qualified BOOLEAN DEFAULT false,
  scheduled_call BOOLEAN DEFAULT false,
  -- Monetization (Success Fee)
  success_fee_cents INTEGER DEFAULT 0,
  success_fee_policy TEXT,
  fee_collected BOOLEAN DEFAULT false,
  fee_collected_at TIMESTAMP,
  fee_collected_by TEXT,
  -- UTM Attribution
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  -- Calendly metadata
  calendly_event_uri TEXT,
  calendly_invitee_uri TEXT,
  scheduled_at TIMESTAMP,
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_scheduled_call ON leads(scheduled_call);
CREATE INDEX IF NOT EXISTS idx_leads_is_high_intent ON leads(is_high_intent);
CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON leads(utm_source);
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Schema changes committed to `migrations/` folder
- [ ] TypeScript compiles: `npm run check`
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass (if applicable)

### Deployment
- [ ] Push to `main` branch
- [ ] Render auto-deploys (watch for build success)
- [ ] Run migration in Render Shell

### Post-Deployment Verification
- [ ] Health check passes: `curl https://your-app.onrender.com/health`
- [ ] Services check passes: `curl https://your-app.onrender.com/api/health`
- [ ] Auth lock verified (incognito → `/dashboard` → redirects to login)
- [ ] Webhook signature rejection: fake signature returns 403
- [ ] Rate limiting active: rapid requests eventually return 429

---

## Rollback Procedure

### If Migration Fails

1. **Immediate:** Render will keep serving the previous deploy
2. **Revert code:**
```bash
git revert HEAD
git push origin main
```

3. **Manual DB rollback** (if needed):
```sql
-- Example: Remove a column that was added
ALTER TABLE leads DROP COLUMN IF EXISTS new_column_name;
```

### If Application Crashes

1. Go to Render Dashboard → Web Service → **Manual Deploy**
2. Select a previous working commit
3. Click **Deploy**

---

## Monitoring & Alerts

### Render Native Monitoring
- Enable **Health Check Alerts** in Web Service settings
- Set notification to Slack/Email

### Application Logs
```bash
# View logs in Render Dashboard → Web Service → Logs
# Or via Render CLI
render logs --service referral-service-ai --tail
```

### Database Monitoring
- Monitor connection count in Render PostgreSQL dashboard
- Set alerts for high CPU/Memory usage

---

## Security Checklist

- [ ] `SKIP_AUTH` is NOT set in production
- [ ] `CLERK_SECRET_KEY` is set (not the test key)
- [ ] `CALENDLY_WEBHOOK_SIGNING_KEY` is set
- [ ] Database uses Internal URL (not External) for Web Service
- [ ] External Database URL is only used for local migrations
- [ ] No secrets in git history

---

## Troubleshooting

### "Connection refused" on migration
- Ensure you're using the **External** Database URL locally
- Check Render PostgreSQL is running
- Verify IP allowlist if configured

### "relation does not exist" errors
- Migration wasn't applied
- Run `npx drizzle-kit migrate` in Render Shell

### Clerk auth failures
- Verify `CLERK_SECRET_KEY` is the production key
- Check Clerk dashboard for API key status

### Webhook 403 errors (legitimate webhooks)
- Verify `CALENDLY_WEBHOOK_SIGNING_KEY` matches Calendly dashboard
- Check raw body parsing middleware order

### Rate limit blocking legitimate traffic
- Verify `trust proxy` is set to `1`
- Check if behind additional proxies (may need `2`)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-XX-XX | Initial production release with full schema |

---

## Contact

For deployment issues: jamarr@referralsvc.com

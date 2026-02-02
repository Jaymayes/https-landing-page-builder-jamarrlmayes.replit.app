# Database Status Check & Migration Decision Tree

## Step 1: Check Your Database Status

### Option A: Via Render PSQL Console
1. Go to Render Dashboard → PostgreSQL → **PSQL**
2. Run:
```sql
-- Check if leads table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'leads'
);

-- If true, count the records
SELECT COUNT(*) as lead_count FROM leads;

-- Check for any Success Fee data
SELECT COUNT(*) as fees_owed FROM leads WHERE success_fee_cents > 0;
```

### Option B: Via Local Terminal (External DB URL)
```bash
export DATABASE_URL="postgresql://user:pass@external-host:5432/db"
npm run db:migrate:status
```

---

## Step 2: Decision Tree

### 🟢 Scenario A: Database is Empty (No Tables or 0 Leads)

**Safe to initialize:**
```bash
# In Render Shell
npm run db:migrate:init
```

This creates all tables with the full v1.0.0 schema including:
- Users, Conversations, Messages
- Leads (with all Success Fee & UTM columns)
- Performance indexes

---

### 🟡 Scenario B: Database Has Tables but 0 Leads

**Safe to initialize** (no commercial data to lose):
```bash
npm run db:migrate:init
```

Or if tables already exist with correct schema:
```bash
npm run db:migrate:status  # Verify schema
```

---

### 🔴 Scenario C: Database Has Leads (Commercial Data Present)

**⚠️ DO NOT RUN db:migrate:init**

Instead, use this **Baseline Workflow**:

#### Step 1: Verify Current Schema
```sql
-- Check which columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'leads' ORDER BY ordinal_position;
```

#### Step 2: Add Missing Columns Manually
If you previously used `db:push`, the tables exist but migrations aren't tracked.
Run only the ALTER statements for columns that don't exist:

```sql
-- Success Fee audit columns (if missing)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS success_fee_policy TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fee_collected_at TIMESTAMP;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fee_collected_by TEXT;

-- UTM Attribution columns (if missing)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer TEXT;

-- Indexes (safe to run - IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON leads(utm_source);
CREATE INDEX IF NOT EXISTS idx_leads_calendly_uri ON leads(calendly_invitee_uri);
```

#### Step 3: Baseline the Migration System
Create the drizzle migrations table to mark current state as "applied":

```sql
-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Mark initial migration as applied (prevents re-running)
INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('initial_baseline_v1.0.0', EXTRACT(EPOCH FROM NOW()) * 1000);
```

Now future `npm run db:migrate` calls will work correctly.

---

## Step 3: Verify Success

```bash
npm run db:migrate:status
```

Expected output:
```
Tables in database:
  - __drizzle_migrations
  - conversations
  - leads
  - messages
  - users

Leads table columns:
  - id: integer
  - name: text
  - ...
  - success_fee_cents: integer
  - utm_source: text
  - ...

Total leads: X
```

---

## Commercial Data Protection Checklist

Before ANY migration operation, verify:

- [ ] `SELECT COUNT(*) FROM leads` - Know your lead count
- [ ] `SELECT SUM(success_fee_cents) FROM leads` - Know your total fees owed
- [ ] `SELECT COUNT(*) FROM leads WHERE fee_collected = true` - Know collected fees
- [ ] **BACKUP** if lead_count > 0: `pg_dump -Fc $DATABASE_URL > backup_$(date +%Y%m%d).dump`

---

## Emergency Rollback

If migration corrupts data:

```bash
# Restore from backup
pg_restore -d $DATABASE_URL backup_YYYYMMDD.dump
```

Or contact Render support for point-in-time recovery (paid plans only).

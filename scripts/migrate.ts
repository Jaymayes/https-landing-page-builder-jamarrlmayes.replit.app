#!/usr/bin/env npx tsx
/**
 * Database Migration Script
 *
 * Usage:
 *   npx tsx scripts/migrate.ts          # Apply pending migrations
 *   npx tsx scripts/migrate.ts --status # Check migration status
 *   npx tsx scripts/migrate.ts --init   # Initialize fresh database
 *
 * Requires DATABASE_URL environment variable.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  console.error("   Export it before running: export DATABASE_URL=postgresql://...");
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args[0] || "migrate";

async function main() {
  console.log("🔌 Connecting to database...");

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    switch (command) {
      case "--status":
        await checkStatus(db);
        break;

      case "--init":
        await initializeDatabase(db);
        break;

      case "migrate":
      default:
        await runMigrations(db);
        break;
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function runMigrations(db: any) {
  console.log("📦 Running migrations...");

  await migrate(db, { migrationsFolder: "./migrations" });

  console.log("✅ Migrations completed successfully");
}

async function checkStatus(db: any) {
  console.log("📊 Checking database status...\n");

  // Check if tables exist
  const tables = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log("Tables in database:");
  if (tables.length === 0) {
    console.log("  (none - database is empty)");
  } else {
    tables.forEach((t: any) => console.log(`  - ${t.table_name}`));
  }

  // Check leads table columns if it exists
  const leadsExists = tables.some((t: any) => t.table_name === "leads");
  if (leadsExists) {
    console.log("\nLeads table columns:");
    const columns = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'leads'
      ORDER BY ordinal_position;
    `);
    columns.forEach((c: any) => {
      console.log(`  - ${c.column_name}: ${c.data_type}${c.column_default ? ` (default: ${c.column_default})` : ""}`);
    });

    // Count records
    const count = await db.execute(sql`SELECT COUNT(*) as count FROM leads`);
    console.log(`\nTotal leads: ${count[0]?.count || 0}`);
  }

  // Check migration history if drizzle migrations table exists
  const hasMigrationTable = tables.some((t: any) => t.table_name === "__drizzle_migrations");
  if (hasMigrationTable) {
    console.log("\nApplied migrations:");
    const migrations = await db.execute(sql`
      SELECT id, hash, created_at
      FROM __drizzle_migrations
      ORDER BY created_at;
    `);
    migrations.forEach((m: any) => {
      console.log(`  - ${m.hash} (${new Date(m.created_at).toISOString()})`);
    });
  }
}

async function initializeDatabase(db: any) {
  console.log("🏗️  Initializing database with full schema...\n");

  // Create all tables
  await db.execute(sql`
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

    -- Leads table (Full v1.0.0 schema)
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Anonymous',
      company TEXT NOT NULL DEFAULT 'Unknown',
      email TEXT NOT NULL DEFAULT '',
      pain_point TEXT NOT NULL,
      company_size TEXT,
      budget_confirmed BOOLEAN DEFAULT false,
      lead_type TEXT DEFAULT 'business_upgrade',
      is_high_intent BOOLEAN DEFAULT false,
      qualified BOOLEAN DEFAULT false,
      scheduled_call BOOLEAN DEFAULT false,
      success_fee_cents INTEGER DEFAULT 0,
      success_fee_policy TEXT,
      fee_collected BOOLEAN DEFAULT false,
      fee_collected_at TIMESTAMP,
      fee_collected_by TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      referrer TEXT,
      calendly_event_uri TEXT,
      calendly_invitee_uri TEXT,
      scheduled_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  console.log("✅ Tables created");

  // Create indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_scheduled_call ON leads(scheduled_call);
    CREATE INDEX IF NOT EXISTS idx_leads_is_high_intent ON leads(is_high_intent);
    CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON leads(utm_source);
    CREATE INDEX IF NOT EXISTS idx_leads_calendly_uri ON leads(calendly_invitee_uri);
  `);

  console.log("✅ Indexes created");
  console.log("\n🎉 Database initialization complete!");
}

main();

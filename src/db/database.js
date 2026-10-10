import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = process.env.DATABASE_FILE || "./data/nawex.db";

fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new DatabaseSync(file);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`);

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN (
        'buyer',
        'supplier',
        'service_provider',
        'admin'
      )),
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      stock REAL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (provider_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS buyer_requests (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      budget REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (buyer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('product','service')),
      item_id TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES buyer_requests(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      offer_id TEXT,
      total REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (offer_id) REFERENCES offers(id)
    );

    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS broker_activities (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      offer_id TEXT,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      activity_type TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES buyer_requests(id),
      FOREIGN KEY (offer_id) REFERENCES offers(id),
      FOREIGN KEY (actor_id) REFERENCES users(id)
    );


    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      objective TEXT NOT NULL,
      budget REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY,
      agent TEXT NOT NULL,
      task_type TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );


    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      offer_id TEXT NOT NULL UNIQUE,
      revenue_model TEXT NOT NULL,
      gross_amount REAL NOT NULL,
      purchase_amount REAL,
      nawex_revenue REAL NOT NULL DEFAULT 0,
      seller_payout REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (offer_id) REFERENCES offers(id)
    );
    
    CREATE TABLE IF NOT EXISTS revenue_lines (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );
    
    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT,
      provider_reference TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    );
    

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'ai',
      specialization TEXT,
      capabilities TEXT,
      tier TEXT NOT NULL DEFAULT 'STARTER',
      share_rate REAL NOT NULL DEFAULT 0.03
        CHECK(share_rate >= 0 AND share_rate <= 1),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_attributions (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL,
      share_rate REAL NOT NULL
        CHECK(share_rate >= 0 AND share_rate <= 1),
      share_amount REAL NOT NULL
        CHECK(share_amount >= 0),
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reversed_at TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      UNIQUE(transaction_id, agent_id, role)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_attributions_transaction
      ON agent_attributions(transaction_id);

    CREATE INDEX IF NOT EXISTS idx_agent_attributions_agent
      ON agent_attributions(agent_id);


    CREATE TABLE IF NOT EXISTS agent_performance (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      transaction_id TEXT,
      score REAL NOT NULL,
      multiplier REAL NOT NULL,
      tier TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_performance_agent
      ON agent_performance(agent_id);

    CREATE INDEX IF NOT EXISTS idx_agent_performance_transaction
      ON agent_performance(transaction_id);


    CREATE TABLE IF NOT EXISTS agent_ledger (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL,

      earned_amount REAL NOT NULL
        CHECK(earned_amount >= 0),

      final_payout REAL NOT NULL DEFAULT 0
        CHECK(final_payout >= 0),

      performance_retention REAL NOT NULL DEFAULT 0
        CHECK(performance_retention >= 0),

      carry_forward REAL NOT NULL DEFAULT 0
        CHECK(carry_forward >= 0),

      currency TEXT NOT NULL DEFAULT 'USD',

      status TEXT NOT NULL DEFAULT 'PENDING',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (transaction_id)
        REFERENCES transactions(id),

      FOREIGN KEY (agent_id)
        REFERENCES agents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_ledger_transaction
      ON agent_ledger(transaction_id);

    CREATE INDEX IF NOT EXISTS idx_agent_ledger_agent
      ON agent_ledger(agent_id);


    CREATE TABLE IF NOT EXISTS agent_milestones (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,

      milestone TEXT NOT NULL,

      percentage REAL NOT NULL
        CHECK(percentage >= 0 AND percentage <= 1),

      amount REAL NOT NULL
        CHECK(amount >= 0),

      currency TEXT NOT NULL DEFAULT 'USD',

      status TEXT NOT NULL DEFAULT 'pending',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (transaction_id)
        REFERENCES transactions(id),

      FOREIGN KEY (agent_id)
        REFERENCES agents(id),

      UNIQUE(
        transaction_id,
        agent_id,
        milestone
      )
    );

    CREATE INDEX IF NOT EXISTS idx_agent_milestones_transaction
      ON agent_milestones(transaction_id);

    CREATE INDEX IF NOT EXISTS idx_agent_milestones_agent
      ON agent_milestones(agent_id);


    CREATE TABLE IF NOT EXISTS agent_payouts (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      ledger_id TEXT NOT NULL,

      milestone TEXT NOT NULL,

      amount REAL NOT NULL
        CHECK(amount >= 0),

      currency TEXT NOT NULL DEFAULT 'USD',

      status TEXT NOT NULL DEFAULT 'pending',

      provider TEXT,
      provider_reference TEXT,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,

      FOREIGN KEY (transaction_id)
        REFERENCES transactions(id),

      FOREIGN KEY (agent_id)
        REFERENCES agents(id),

      FOREIGN KEY (ledger_id)
        REFERENCES agent_ledger(id),

      UNIQUE(
        transaction_id,
        agent_id,
        milestone
      )
    );

    CREATE INDEX IF NOT EXISTS idx_agent_payouts_transaction
      ON agent_payouts(transaction_id);

    CREATE INDEX IF NOT EXISTS idx_agent_payouts_agent
      ON agent_payouts(agent_id);

    CREATE INDEX IF NOT EXISTS idx_agent_payouts_ledger
      ON agent_payouts(ledger_id);


    CREATE TABLE IF NOT EXISTS agent_opportunities (
      id TEXT PRIMARY KEY,

      agent_id TEXT NOT NULL,

      source_type TEXT NOT NULL,
      source_url TEXT,

      title TEXT NOT NULL,
      description TEXT,

      category TEXT,

      counterparty_name TEXT,
      counterparty_type TEXT,

      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,

      external_reference TEXT,

      direction TEXT NOT NULL
        CHECK(direction IN ('BUY','SELL','BROKER','SERVICE')),

      transaction_model TEXT
        CHECK(transaction_model IN (
          'COMMISSION',
          'BROKER',
          'BUY_AND_RESELL',
          'SERVICE',
          'EXECUTION_FEE'
        )),

      estimated_value REAL
        CHECK(estimated_value IS NULL OR estimated_value >= 0),

      currency TEXT NOT NULL DEFAULT 'USD',

      confidence REAL NOT NULL DEFAULT 0
        CHECK(confidence >= 0 AND confidence <= 1),

      status TEXT NOT NULL DEFAULT 'discovered'
        CHECK(status IN (
          'discovered',
          'verifying',
          'verified',
          'contacted',
          'negotiating',
          'qualified',
          'converted',
          'lost',
          'rejected'
        )),

      rejection_reason TEXT,

      discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      verified_at TEXT,
      converted_at TEXT,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (agent_id)
        REFERENCES agents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_opportunities_agent
      ON agent_opportunities(agent_id);

    CREATE INDEX IF NOT EXISTS idx_agent_opportunities_status
      ON agent_opportunities(status);

    CREATE INDEX IF NOT EXISTS idx_agent_opportunities_category
      ON agent_opportunities(category);

    CREATE INDEX IF NOT EXISTS idx_agent_opportunities_source
      ON agent_opportunities(source_type);


    CREATE TABLE IF NOT EXISTS agent_verifications (
      id TEXT PRIMARY KEY,

      opportunity_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,

      verification_type TEXT NOT NULL,

      subject TEXT NOT NULL,

      source_type TEXT,
      source_url TEXT,

      claim TEXT NOT NULL,
      evidence TEXT,

      result TEXT NOT NULL
        CHECK(result IN (
          'pending',
          'verified',
          'failed',
          'inconclusive'
        )),

      confidence REAL NOT NULL DEFAULT 0
        CHECK(confidence >= 0 AND confidence <= 1),

      verified_at TEXT,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (opportunity_id)
        REFERENCES agent_opportunities(id),

      FOREIGN KEY (agent_id)
        REFERENCES agents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_verifications_opportunity
      ON agent_verifications(opportunity_id);

    CREATE INDEX IF NOT EXISTS idx_agent_verifications_agent
      ON agent_verifications(agent_id);

    CREATE INDEX IF NOT EXISTS idx_agent_verifications_result
      ON agent_verifications(result);


    CREATE TABLE IF NOT EXISTS agent_followups (
      id TEXT PRIMARY KEY,

      opportunity_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,

      channel TEXT NOT NULL,

      contact TEXT,

      action TEXT NOT NULL,

      message TEXT,

      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN (
          'pending',
          'sent',
          'replied',
          'no_response',
          'failed',
          'cancelled'
        )),

      scheduled_at TEXT,
      executed_at TEXT,

      response TEXT,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (opportunity_id)
        REFERENCES agent_opportunities(id),

      FOREIGN KEY (agent_id)
        REFERENCES agents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_followups_opportunity
      ON agent_followups(opportunity_id);

    CREATE INDEX IF NOT EXISTS idx_agent_followups_agent
      ON agent_followups(agent_id);

    CREATE INDEX IF NOT EXISTS idx_agent_followups_status
      ON agent_followups(status);

  `);

  runSqlMigrations();
}

function runSqlMigrations() {
  const migrationsDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "migrations"
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of files) {
    const applied = db.prepare(
      "SELECT name FROM schema_migrations WHERE name = ?"
    ).get(name);

    if (applied) continue;

    const sql = fs.readFileSync(
      path.join(migrationsDir, name),
      "utf8"
    );

    db.exec("BEGIN IMMEDIATE");

    try {
      db.exec(sql);

      db.prepare(
        "INSERT INTO schema_migrations (name) VALUES (?)"
      ).run(name);

      db.exec("COMMIT");
      console.log(`Applied migration: ${name}`);
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {}

      throw new Error(
        `Migration ${name} failed: ${error.message}`
      );
    }
  }
}

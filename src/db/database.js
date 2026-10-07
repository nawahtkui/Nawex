import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const file = process.env.DATABASE_FILE || "./data/nawex.db";

fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new Database(file);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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
`);
}

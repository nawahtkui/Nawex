CREATE TABLE IF NOT EXISTS service_orders (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,

    order_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,

    amount REAL,
    currency TEXT DEFAULT 'USD',

    status TEXT DEFAULT 'created',

    provider_id TEXT,
    external_order_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS fulfillment_tasks (
    id TEXT PRIMARY KEY,

    order_id TEXT NOT NULL,

    provider_id TEXT,
    task_type TEXT NOT NULL,

    status TEXT DEFAULT 'pending',

    result TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

import { db } from "../db/database.js";
import { id } from "../utils.js";
import { findMatches } from "../services/matching.js";

export function executeBuyerTask({
buyerId,
title,
description,
category,
budget,
currency = "USD"
}) {
const requestId = id("req");

db.prepare(`
INSERT INTO buyer_requests
(id, buyer_id, title, description, category, budget, currency)
VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
requestId,
buyerId,
title,
description,
category || null,
budget ?? null,
currency
);

const matches = findMatches({
title,
description,
category
});

return {
requestId,
matches
};
}

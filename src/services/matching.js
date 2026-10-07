import { db } from "../db/database.js";

function normalize(value) {
return String(value || "").toLowerCase().trim();
}

export function findMatches(request) {
const category = normalize(request.category);
const text = normalize(`${request.title} ${request.description}`);

const products = db.prepare(`
SELECT
p.*,
u.name AS supplier_name
FROM products p
JOIN users u ON u.id = p.supplier_id
WHERE p.status = 'active'
`).all();

const services = db.prepare(`
SELECT
s.*,
u.name AS provider_name
FROM services s
JOIN users u ON u.id = s.provider_id
WHERE s.status = 'active'
`).all();

const scoredProducts = products.map(item => ({
type: "product",
item,
score: score(item, category, text)
}));

const scoredServices = services.map(item => ({
type: "service",
item,
score: score(item, category, text)
}));

return [...scoredProducts, ...scoredServices]
.filter(x => x.score > 0)
.sort((a, b) => b.score - a.score)
.slice(0, 20);
}

function score(item, category, text) {
let score = 0;

if (normalize(item.category) === category && category) {
score += 60;
}

const haystack = normalize(
`${item.name} ${item.description} ${item.category}`
);

for (const word of text.split(/\s+/).filter(Boolean)) {
if (word.length >= 3 && haystack.includes(word)) {
score += 10;
}
}

return score;
}

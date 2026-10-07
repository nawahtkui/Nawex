import crypto from "node:crypto";

export function id(prefix) {
return `${prefix}_${crypto.randomUUID()}`;
}

export function json(value) {
return JSON.stringify(value ?? {});
}

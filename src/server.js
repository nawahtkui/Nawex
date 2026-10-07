import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { migrate } from "./db/database.js";

import health from "./routes/health.js";
import users from "./routes/users.js";
import catalog from "./routes/catalog.js";
import buyer from "./routes/buyer.js";
import offers from "./routes/offers.js";
import orders from "./routes/orders.js";
import marketing from "./routes/marketing.js";
import agents from "./routes/agents.js";

migrate();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
res.json({
name: "Nawex",
version: "0.1.0",
description: "Agent-powered business network",
capabilities: [
"buyers",
"suppliers",
"service-providers",
"products",
"services",
"matching",
"offers",
"orders",
"marketing",
"agents"
]
});
});

app.use("/api/health", health);
app.use("/api/users", users);
app.use("/api/catalog", catalog);
app.use("/api/buyer", buyer);
app.use("/api/offers", offers);
app.use("/api/orders", orders);
app.use("/api/marketing", marketing);
app.use("/api/agents", agents);

app.use((err, req, res, next) => {
console.error(err);

res.status(500).json({
error: "internal_server_error"
});
});

const port = Number(process.env.PORT || 4300);

app.listen(port, () => {
console.log(`Nawex API running on http://localhost:${port}`);
});

import express from "express";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";
import { rest } from "./rest.js";
import { mcpHandler } from "./mcp.js";
import { track, trackError, shutdownObservability } from "./observability.js";
import "./db.js"; // initialise + seed SQLite on boot

const app = express();

// CORS — the frontend (separate origin) calls the REST API from the browser.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// GraphQL (mounted before express.json so Yoga parses its own body)
const yoga = createYoga({ schema, graphqlEndpoint: "/graphql", landingPage: true, cors: true });
app.use(yoga.graphqlEndpoint, yoga);

// JSON body parsing for REST + MCP
app.use(express.json());
app.use("/api", rest);
app.all("/mcp", mcpHandler);

app.get("/", (_req, res) =>
  res.json({
    service: "restaurant-delivery-backend",
    storage: "sqlite",
    endpoints: { rest: "/api", graphql: "/graphql", mcp: "/mcp (JSON-RPC)" },
  })
);

// Error-tracking middleware — must be registered last so it catches route errors.
app.use((err, req, res, _next) => {
  trackError(err, { route: req.originalUrl, method: req.method });
  console.error("unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "internal server error" });
});

// Last-resort process-level capture.
process.on("uncaughtException", (err) => { trackError(err, { kind: "uncaughtException" }); });
process.on("unhandledRejection", (reason) => {
  trackError(reason instanceof Error ? reason : new Error(String(reason)), { kind: "unhandledRejection" });
});
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => { await shutdownObservability(); process.exit(0); });
}

const port = process.env.PORT || 4000;
app.listen(port, () => {
  track("backend_started", { port: Number(port) });
  console.log(`restaurant-delivery-backend on :${port} — REST /api · GraphQL /graphql · MCP /mcp (SQLite)`);
});

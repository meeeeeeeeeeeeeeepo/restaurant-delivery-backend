import express from "express";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";
import { rest } from "./rest.js";
import { mcpHandler } from "./mcp.js";
import "./db.js"; // initialise + seed SQLite on boot

const app = express();

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

const port = process.env.PORT || 4000;
app.listen(port, () =>
  console.log(`restaurant-delivery-backend on :${port} — REST /api · GraphQL /graphql · MCP /mcp (SQLite)`)
);

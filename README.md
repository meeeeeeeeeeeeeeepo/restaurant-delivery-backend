# restaurant-delivery-backend

Restaurant delivery API backed by **SQLite** (Node's built-in `node:sqlite`), exposing three interfaces:

| Interface | Path | Purpose |
|---|---|---|
| **REST** | `/api/*` | Admin + ordering: menu CRUD, prices, working hours, orders |
| **MCP** | `/mcp` | Model Context Protocol (JSON-RPC) so chatbots can browse the menu and place orders |
| **GraphQL** | `/graphql` | Typed API implementing the shared `@meeeeeeeeeeeeeeepo/restaurant-schema` |

## REST routes

```
GET    /api/health
GET    /api/menu[?category=PIZZA]      GET /api/menu/:id
POST   /api/menu                       # add item {category,name,description,price,veg}
PATCH  /api/menu/:id                   # update item (incl. price, availability)
PUT    /api/menu/:id/price             # set price {price}
DELETE /api/menu/:id
GET    /api/hours                      PUT /api/hours/:day   # set {open_time,close_time,closed}
POST   /api/orders                     GET /api/orders/:id
```

## MCP (chatbot ordering)

`POST /mcp` speaks JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`). Tools:
`list_menu`, `get_working_hours`, `place_order`. Point any MCP-capable chatbot at
`https://<host>/mcp` to take orders conversationally.

## Run locally

```bash
export NODE_AUTH_TOKEN=<GitHub packages:read token>
npm ci
npm start        # :4000 — REST /api · GraphQL /graphql · MCP /mcp  (SQLite at ./data)
npm test
```

## Deploy (Render)

`render.yaml` defines **production** (`main`) and **staging** (`develop`). Data lives in SQLite
at `DB_PATH` (`./data/restaurant.db`). Render free tier has an ephemeral disk — attach a Render
Disk and point `DB_PATH` at it for durability.

**CI/CD is Slack-driven:** push `develop` → staging deploy; the **"Promote to Production"**
Slack workflow fires a `repository_dispatch` that deploys production. All activity (commits, PRs,
reviews, deployments) is reported to Slack.

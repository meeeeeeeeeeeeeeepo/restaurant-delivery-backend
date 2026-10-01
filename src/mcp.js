// MCP server (official @modelcontextprotocol/sdk) over Streamable HTTP, stateless.
// Lets chatbots — including Slackbot via the Slack MCP client — browse the menu,
// check hours and place delivery orders.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import * as store from "./db.js";

function buildServer() {
  const server = new McpServer({ name: "restaurant-delivery-mcp", version: "1.1.0" });

  server.registerTool(
    "list_menu",
    {
      description: "List the restaurant's menu items, optionally filtered by category (STARTERS, PIZZA, PASTA, DESSERTS, DRINKS).",
      inputSchema: { category: z.string().optional() },
    },
    async ({ category }) => {
      const items = store.listMenu(category);
      const text = `Menu (${items.length} items):\n` +
        items.map((i) => `- [${i.id}] ${i.name} (${i.category}) — £${i.price.toFixed(2)}${i.veg ? " 🌱" : ""}${i.available ? "" : " (unavailable)"}`).join("\n");
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "get_working_hours",
    { description: "Get the restaurant's opening hours for each day of the week.", inputSchema: {} },
    async () => {
      const text = "Opening hours:\n" + store.listHours()
        .map((h) => `- ${h.day}: ${h.closed ? "Closed" : `${h.open_time}–${h.close_time}`}`).join("\n");
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "place_order",
    {
      description: "Place a delivery order. Provide items (menu item id + qty) and the customer's name, address and phone.",
      inputSchema: {
        items: z.array(z.object({ id: z.string(), qty: z.number().int().positive() })).min(1),
        customer: z.object({ name: z.string(), address: z.string(), phone: z.string() }),
      },
    },
    async ({ items, customer }) => {
      try {
        const order = store.createOrder({ items, customer });
        const text = `✅ Order ${order.id} confirmed. Total £${order.total.toFixed(2)} ` +
          `(subtotal £${order.subtotal.toFixed(2)}, delivery £${order.deliveryFee.toFixed(2)}). ETA ${order.etaMinutes} min.`;
        return { content: [{ type: "text", text }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    },
  );

  return server;
}

// Stateless: a fresh server + transport per request (no session store needed).
export async function mcpHandler(req, res) {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: e.message }, id: null });
    }
  }
}

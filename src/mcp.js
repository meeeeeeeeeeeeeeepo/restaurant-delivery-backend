// Minimal Model Context Protocol (JSON-RPC 2.0) endpoint so chatbots can
// browse the menu, check hours and place delivery orders. Stateless HTTP.
import * as store from "./db.js";

const TOOLS = [
  {
    name: "list_menu",
    description: "List the restaurant's menu items, optionally filtered by category (STARTERS, PIZZA, PASTA, DESSERTS, DRINKS).",
    inputSchema: {
      type: "object",
      properties: { category: { type: "string", description: "Optional category filter" } },
    },
  },
  {
    name: "get_working_hours",
    description: "Get the restaurant's opening hours for each day of the week.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "place_order",
    description: "Place a delivery order. Provide items (menu item id + qty) and the customer's name, address and phone.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string" }, qty: { type: "integer" } },
            required: ["id", "qty"],
          },
        },
        customer: {
          type: "object",
          properties: {
            name: { type: "string" }, address: { type: "string" }, phone: { type: "string" },
          },
          required: ["name", "address", "phone"],
        },
      },
      required: ["items", "customer"],
    },
  },
];

function callTool(name, args) {
  if (name === "list_menu") {
    const items = store.listMenu(args?.category);
    return `Menu (${items.length} items):\n` +
      items.map((i) => `- [${i.id}] ${i.name} (${i.category}) — £${i.price.toFixed(2)}${i.veg ? " 🌱" : ""}${i.available ? "" : " (unavailable)"}`).join("\n");
  }
  if (name === "get_working_hours") {
    return "Opening hours:\n" + store.listHours()
      .map((h) => `- ${h.day}: ${h.closed ? "Closed" : `${h.open_time}–${h.close_time}`}`).join("\n");
  }
  if (name === "place_order") {
    const order = store.createOrder({ items: args.items, customer: args.customer });
    return `✅ Order ${order.id} confirmed. Total £${order.total.toFixed(2)} ` +
      `(subtotal £${order.subtotal.toFixed(2)}, delivery £${order.deliveryFee.toFixed(2)}). ETA ${order.etaMinutes} min.`;
  }
  throw new Error(`unknown tool: ${name}`);
}

const SERVER_INFO = { name: "restaurant-delivery-mcp", version: "1.1.0" };

export function mcpHandler(req, res) {
  if (req.method === "GET") {
    // No server-initiated streaming in this stateless server.
    return res.status(405).json({ error: "Use POST for JSON-RPC MCP requests" });
  }
  const msg = req.body;
  const reply = (result, id) => res.json({ jsonrpc: "2.0", id, result });
  const fail = (code, message, id) => res.json({ jsonrpc: "2.0", id, error: { code, message } });

  try {
    const { method, id, params } = msg ?? {};
    if (method === "initialize") {
      return reply({
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      }, id);
    }
    if (method === "notifications/initialized" || method === "notifications/cancelled") {
      return res.status(202).end();
    }
    if (method === "ping") return reply({}, id);
    if (method === "tools/list") return reply({ tools: TOOLS }, id);
    if (method === "tools/call") {
      try {
        const text = callTool(params?.name, params?.arguments ?? {});
        return reply({ content: [{ type: "text", text }] }, id);
      } catch (e) {
        return reply({ content: [{ type: "text", text: `Error: ${e.message}` }], isError: true }, id);
      }
    }
    return fail(-32601, `Method not found: ${method}`, id ?? null);
  } catch (e) {
    return fail(-32603, e.message, msg?.id ?? null);
  }
}

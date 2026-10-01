import { Router } from "express";
import * as store from "./db.js";
import { track, trackError } from "./observability.js";

export const rest = Router();

rest.get("/health", (_req, res) =>
  res.json({ status: "ok", service: "restaurant-delivery-backend", time: new Date().toISOString() })
);

// ---- menu ----
rest.get("/menu", (req, res) => {
  const items = store.listMenu(req.query.category);
  res.json({ count: items.length, items });
});
rest.get("/menu/:id", (req, res) => {
  const item = store.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: "menu item not found" });
  res.json(item);
});
rest.post("/menu", (req, res) => {
  const { category, name, price } = req.body ?? {};
  if (!category || !name || typeof price !== "number") {
    return res.status(400).json({ error: "category, name and numeric price are required" });
  }
  res.status(201).json(store.addItem(req.body));
});
rest.patch("/menu/:id", (req, res) => {
  const updated = store.updateItem(req.params.id, req.body ?? {});
  if (!updated) return res.status(404).json({ error: "menu item not found" });
  res.json(updated);
});
// dedicated price route
rest.put("/menu/:id/price", (req, res) => {
  const { price } = req.body ?? {};
  if (typeof price !== "number") return res.status(400).json({ error: "numeric price required" });
  const updated = store.setPrice(req.params.id, price);
  if (!updated) return res.status(404).json({ error: "menu item not found" });
  res.json(updated);
});
rest.delete("/menu/:id", (req, res) => {
  res.json({ deleted: store.deleteItem(req.params.id) });
});

// ---- working hours ----
rest.get("/hours", (_req, res) => res.json({ hours: store.listHours() }));
rest.put("/hours/:day", (req, res) => {
  res.json(store.setHours(req.params.day, req.body ?? {}));
});

// ---- sales report (powers the self-writing Sales Canvas) ----
rest.get("/reports/sales", (req, res) => {
  const report = store.salesReport();
  track("sales_report_generated", {
    source: req.query.source || "rest",
    revenue: report.revenue,
    orders: report.orders,
    wow_change_pct: report.wowChangePct,
    top_item: report.topItems?.[0]?.name,
  });
  res.json(report);
});

// ---- orders ----
rest.post("/orders", (req, res) => {
  try {
    const order = store.createOrder(req.body ?? {});
    track("order_placed", {
      order_id: order.id,
      total: order.total,
      channel: req.body?.channel || "rest",
      item_count: order.items?.length,
    });
    res.status(201).json(order);
  } catch (e) {
    trackError(e, { route: "/api/orders" });
    res.status(400).json({ error: e.message });
  }
});
rest.get("/orders/:id", (req, res) => {
  const order = store.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "order not found" });
  res.json(order);
});

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// SQLite file — on Render set DB_PATH to a mounted disk path (e.g. /data/restaurant.db)
const DB_PATH = process.env.DB_PATH || "./data/restaurant.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL,
    veg INTEGER NOT NULL DEFAULT 0,
    available INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS working_hours (
    day TEXT PRIMARY KEY,
    open_time TEXT,
    close_time TEXT,
    closed INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    customer TEXT NOT NULL,
    items TEXT NOT NULL,
    subtotal REAL NOT NULL,
    delivery_fee REAL NOT NULL,
    total REAL NOT NULL,
    eta_minutes INTEGER NOT NULL
  );
`);

// ---- seed on first run ----
const seedMenu = [
  ["m1", "STARTERS", "Bruschetta al Pomodoro", "Grilled sourdough, vine tomatoes, basil, garlic, olive oil.", 7.5, 1],
  ["m2", "STARTERS", "Arancini", "Crispy saffron rice balls, mozzarella, pomodoro dip.", 8.0, 1],
  ["m3", "PIZZA", "Margherita", "San Marzano tomato, fior di latte, basil.", 12.0, 1],
  ["m4", "PIZZA", "Diavola", "Spicy salami, tomato, mozzarella, chilli honey.", 14.5, 0],
  ["m5", "PIZZA", "Quattro Formaggi", "Mozzarella, gorgonzola, fontina, parmigiano.", 15.0, 1],
  ["m6", "PASTA", "Spaghetti Carbonara", "Guanciale, egg yolk, pecorino, black pepper.", 13.5, 0],
  ["m7", "PASTA", "Penne Arrabbiata", "Garlic, chilli, tomato, parsley.", 11.5, 1],
  ["m8", "DESSERTS", "Tiramisu", "Mascarpone, espresso-soaked savoiardi, cocoa.", 6.5, 1],
  ["m9", "DESSERTS", "Panna Cotta", "Vanilla cream, mixed-berry coulis.", 6.0, 1],
  ["m10", "DRINKS", "San Pellegrino", "Sparkling mineral water, 500ml.", 3.0, 1],
  ["m11", "DRINKS", "Chianti (glass)", "Tuscan red, 175ml.", 7.0, 1],
];

const seedHours = [
  ["Monday", "11:00", "22:00", 0],
  ["Tuesday", "11:00", "22:00", 0],
  ["Wednesday", "11:00", "22:00", 0],
  ["Thursday", "11:00", "22:00", 0],
  ["Friday", "11:00", "23:00", 0],
  ["Saturday", "12:00", "23:00", 0],
  ["Sunday", "12:00", "21:00", 0],
];

const count = db.prepare("SELECT COUNT(*) AS n FROM menu_items").get().n;
if (count === 0) {
  const ins = db.prepare(
    "INSERT INTO menu_items (id,category,name,description,price,veg) VALUES (?,?,?,?,?,?)",
  );
  for (const r of seedMenu) ins.run(...r);
  const insH = db.prepare(
    "INSERT INTO working_hours (day,open_time,close_time,closed) VALUES (?,?,?,?)",
  );
  for (const h of seedHours) insH.run(...h);
  console.log(`seeded ${seedMenu.length} menu items and ${seedHours.length} working-hours rows`);
}

// ---- data access helpers ----
const rowToItem = (r) => r && ({ ...r, veg: !!r.veg, available: !!r.available });

export const listMenu = (category) => {
  const rows = category
    ? db.prepare("SELECT * FROM menu_items WHERE category = ? ORDER BY name").all(category)
    : db.prepare("SELECT * FROM menu_items ORDER BY category, name").all();
  return rows.map(rowToItem);
};
export const getItem = (id) => rowToItem(db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id));

export const addItem = ({ id, category, name, description = "", price, veg = false }) => {
  const newId = id || `m_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  db.prepare(
    "INSERT INTO menu_items (id,category,name,description,price,veg) VALUES (?,?,?,?,?,?)",
  ).run(newId, category, name, description, price, veg ? 1 : 0);
  return getItem(newId);
};

export const updateItem = (id, patch) => {
  const cur = getItem(id);
  if (!cur) return null;
  const next = {
    category: patch.category ?? cur.category,
    name: patch.name ?? cur.name,
    description: patch.description ?? cur.description,
    price: patch.price ?? cur.price,
    veg: patch.veg ?? cur.veg,
    available: patch.available ?? cur.available,
  };
  db.prepare(
    "UPDATE menu_items SET category=?,name=?,description=?,price=?,veg=?,available=? WHERE id=?",
  ).run(next.category, next.name, next.description, next.price, next.veg ? 1 : 0, next.available ? 1 : 0, id);
  return getItem(id);
};

export const setPrice = (id, price) => updateItem(id, { price });
export const deleteItem = (id) => db.prepare("DELETE FROM menu_items WHERE id = ?").run(id).changes > 0;

export const listHours = () => db.prepare("SELECT * FROM working_hours").all().map((h) => ({ ...h, closed: !!h.closed }));
export const setHours = (day, { open_time, close_time, closed = false }) => {
  db.prepare(
    "INSERT INTO working_hours (day,open_time,close_time,closed) VALUES (?,?,?,?) " +
    "ON CONFLICT(day) DO UPDATE SET open_time=excluded.open_time, close_time=excluded.close_time, closed=excluded.closed",
  ).run(day, open_time ?? null, close_time ?? null, closed ? 1 : 0);
  return db.prepare("SELECT * FROM working_hours WHERE day = ?").get(day);
};

export const createOrder = ({ items, customer }) => {
  if (!Array.isArray(items) || items.length === 0) throw new Error("order must contain at least one item");
  if (!customer?.name || !customer?.address || !customer?.phone) {
    throw new Error("customer name, address and phone are required for delivery");
  }
  let subtotal = 0;
  const lineItems = items.map((line) => {
    const item = getItem(line.id);
    if (!item) throw new Error(`unknown menu item: ${line.id}`);
    if (!item.available) throw new Error(`item not available: ${item.name}`);
    const qty = Number.isInteger(line.qty) && line.qty > 0 ? line.qty : 1;
    subtotal += item.price * qty;
    return { id: item.id, name: item.name, qty, price: item.price };
  });
  const deliveryFee = subtotal >= 25 ? 0 : 2.99;
  const order = {
    id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    status: "CONFIRMED",
    customer,
    items: lineItems,
    subtotal: Number(subtotal.toFixed(2)),
    deliveryFee,
    total: Number((subtotal + deliveryFee).toFixed(2)),
    etaMinutes: 35,
  };
  db.prepare(
    "INSERT INTO orders (id,created_at,status,customer,items,subtotal,delivery_fee,total,eta_minutes) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(order.id, order.createdAt, order.status, JSON.stringify(customer), JSON.stringify(lineItems), order.subtotal, order.deliveryFee, order.total, order.etaMinutes);
  return order;
};

export const getOrder = (id) => {
  const r = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!r) return null;
  return {
    id: r.id, createdAt: r.created_at, status: r.status,
    customer: JSON.parse(r.customer), items: JSON.parse(r.items),
    subtotal: r.subtotal, deliveryFee: r.delivery_fee, total: r.total, etaMinutes: r.eta_minutes,
  };
};

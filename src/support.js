// Restaurant Support Desk — customer-facing support conversations.
//
// Customers report FROM the restaurant app; messages are stored here (SQLite)
// and mirrored into Slack via a run-on-Slack webhook trigger, where staff
// answer in a thread. Staff replies come back via POST /reply (no Slack push,
// to avoid an echo loop). Slack is purely the answering surface.
import { db } from "./db.js";
import { track, trackError } from "./observability.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    requester_name TEXT NOT NULL DEFAULT 'Customer',
    status TEXT NOT NULL DEFAULT 'OPEN',
    last_activity TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    sender TEXT NOT NULL,           -- 'customer' | 'staff'
    author TEXT NOT NULL DEFAULT '',-- display name or slack user id
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const SLACK_WEBHOOK = process.env.SUPPORT_SLACK_WEBHOOK || "";

function now() { return new Date().toISOString(); }
function newId() { return `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

export function getTicket(id) {
  return db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id) ?? null;
}

export function listMessages(ticketId) {
  return db.prepare("SELECT id, sender, author, text, created_at FROM support_messages WHERE ticket_id = ? ORDER BY id ASC").all(ticketId);
}

function addMessage(ticketId, sender, author, text) {
  db.prepare("INSERT INTO support_messages (ticket_id, sender, author, text, created_at) VALUES (?,?,?,?,?)")
    .run(ticketId, sender, author ?? "", text, now());
  db.prepare("UPDATE support_tickets SET last_activity = ? WHERE id = ?").run(now(), ticketId);
}

// Push an app-originated customer message into Slack via the webhook trigger.
async function notifySlack(ticketId, name, message) {
  if (!SLACK_WEBHOOK) return { ok: false, skipped: true };
  try {
    const r = await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket_id: ticketId, name, message }),
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    trackError(e, { where: "support.notifySlack" });
    return { ok: false, error: String(e) };
  }
}

/** Customer posts a support message from the app. Creates the ticket on first
 *  message, stores it, and mirrors it to Slack. */
export async function customerMessage({ ticket_id, name, message }) {
  if (!message || !String(message).trim()) throw new Error("message is required");
  let ticket = ticket_id ? getTicket(ticket_id) : null;
  const isNew = !ticket;
  if (!ticket) {
    const id = newId();
    db.prepare("INSERT INTO support_tickets (id, created_at, requester_name, status, last_activity) VALUES (?,?,?,?,?)")
      .run(id, now(), name || "Customer", "OPEN", now());
    ticket = getTicket(id);
  }
  addMessage(ticket.id, "customer", name || ticket.requester_name, message);
  const slack = await notifySlack(ticket.id, name || ticket.requester_name, message);
  track("support_customer_message", { ticket_id: ticket.id, new_ticket: isNew, slack_ok: slack.ok === true });
  return { ticket_id: ticket.id, ticket: getTicket(ticket.id), messages: listMessages(ticket.id), slack };
}

/** Staff reply arriving from Slack. Stored only — NOT pushed back to Slack. */
export function staffReply(ticketId, { author, text }) {
  const ticket = getTicket(ticketId);
  if (!ticket) throw new Error("ticket not found");
  if (!text || !String(text).trim()) throw new Error("text is required");
  addMessage(ticketId, "staff", author ?? "staff", text);
  track("support_staff_reply", { ticket_id: ticketId });
  return { ticket_id: ticketId, messages: listMessages(ticketId) };
}

export function setStatus(ticketId, status) {
  db.prepare("UPDATE support_tickets SET status = ?, last_activity = ? WHERE id = ?").run(status, now(), ticketId);
  return getTicket(ticketId);
}

export function listTickets() {
  return db.prepare("SELECT * FROM support_tickets ORDER BY last_activity DESC").all();
}

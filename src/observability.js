// PostHog observability for the restaurant backend.
// Captures product events (orders, sales reports) and server-side exceptions so
// we can actually SEE what the service is doing in production instead of guessing
// from truncated logs. Key/host come from env, with the project defaults baked in
// so a fresh Render deploy works without extra config.
import { PostHog } from "posthog-node";

const KEY = process.env.POSTHOG_KEY || "phc_ngadEZcCq8ukakdJM6SUjW3txkzsz9HetqxTVgFGRg4c";
const HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
const SERVICE = "restaurant-delivery-backend";
const ENV = process.env.RENDER_SERVICE_NAME || process.env.NODE_ENV || "local";

// flushAt:1 so events ship immediately — this is a low-traffic demo, not a firehose,
// and we'd rather see every event than batch for throughput.
export const posthog = new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 });

const common = () => ({ service: SERVICE, deploy_env: ENV });

/** Capture a product/analytics event. distinctId defaults to the service name. */
export function track(event, properties = {}, distinctId = SERVICE) {
  try {
    posthog.capture({ distinctId, event, properties: { ...common(), ...properties } });
  } catch (_) { /* observability must never break the request path */ }
}

/** Capture a server-side exception for Error Tracking. */
export function trackError(error, properties = {}, distinctId = SERVICE) {
  try {
    posthog.captureException(error, distinctId, { ...common(), ...properties });
  } catch (_) { /* swallow */ }
}

/** Flush and close the client on shutdown so queued events are not lost. */
export async function shutdownObservability() {
  try { await posthog.shutdown(); } catch (_) { /* swallow */ }
}

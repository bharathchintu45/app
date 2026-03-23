/**
 * In-memory rate limiter for Supabase Edge Functions.
 *
 * Uses a sliding-window counter keyed by IP (or user ID when authenticated).
 * The store lives in the isolate's memory, so it resets when the function
 * cold-starts — this is acceptable for edge-function rate limiting because
 * Supabase already provides per-function concurrency limits.
 *
 * Usage:
 *   import { rateLimit, RateLimitConfig } from "../_shared/rate-limiter.ts";
 *
 *   const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 };
 *
 *   Deno.serve(async (req) => {
 *     const limited = rateLimit(req, config);
 *     if (limited) return limited;          // 429 response
 *     // ... normal handler
 *   });
 */

export interface RateLimitConfig {
  /** Time window in milliseconds (default: 60 000 = 1 minute) */
  windowMs?: number;
  /** Maximum requests per window per key (default: 10) */
  maxRequests?: number;
  /** Custom key extractor — defaults to IP from headers */
  keyExtractor?: (req: Request) => string;
  /** Custom message on 429 */
  message?: string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Shared across invocations within the same isolate
const store = new Map<string, WindowEntry>();

// Periodic cleanup to prevent memory leak — runs at most once per minute
let lastCleanup = 0;
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Extract a rate-limit key from the request.
 * Priority: Authorization token hash → X-Forwarded-For → X-Real-IP → "anonymous"
 */
function defaultKeyExtractor(req: Request): string {
  // Prefer user identity if authenticated
  const auth = req.headers.get("authorization");
  if (auth) {
    // Use last 16 chars of the token as a lightweight key (avoids storing full JWTs)
    const token = auth.replace(/^Bearer\s+/i, "");
    return `user:${token.slice(-16)}`;
  }

  // Fall back to IP
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return `ip:${forwarded.split(",")[0].trim()}`;

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp}`;

  return "anonymous";
}

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://thefitbowls.vercel.app";

/**
 * Check rate limit. Returns a 429 Response if the caller is over the limit,
 * or `null` if the request is allowed.
 */
export function rateLimit(
  req: Request,
  config: RateLimitConfig = {}
): Response | null {
  const {
    windowMs = 60_000,
    maxRequests = 10,
    keyExtractor = defaultKeyExtractor,
    message = "Too many requests. Please try again later.",
  } = config;

  cleanup();

  const key = keyExtractor(req);
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  const origin = req.headers.get('origin') || '*';
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(Math.max(0, maxRequests - entry.count)),
    "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
    "Access-Control-Allow-Origin": origin === 'null' ? '*' : origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 429,
        headers: { ...headers, "Retry-After": String(retryAfter) },
      }
    );
  }

  return null; // allowed
}

const buckets = globalThis.__cutproRateLimits || new Map();
globalThis.__cutproRateLimits = buckets;

export function checkRateLimit(key, { limit = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  existing.count += 1;
  if (existing.count > limit) return { allowed: false, remaining: 0, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  return { allowed: true, remaining: limit - existing.count };
}

export function getRequestIp(request) {
  return (
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function passesHoneypot(input) {
  if (input.website) return false;
  const startedAt = Number(input.startedAt);
  return Number.isFinite(startedAt) && Date.now() - startedAt >= 1200;
}

export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
    });
    const result = await response.json();
    return Boolean(result.success);
  } catch {
    return false;
  }
}


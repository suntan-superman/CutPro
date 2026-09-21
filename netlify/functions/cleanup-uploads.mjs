import { createClient } from "@supabase/supabase-js";
import { cleanupUploads } from "../../scripts/lib/cleanup-uploads.mjs";

// Netlify scheduled functions have no public invocation URL in production.
// Use the existing site's Functions > cleanup-uploads > Run now for a manual run.
export default async function cleanupScheduledUploads() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Upload cleanup is not configured.");
  const deadline = Date.now() + 26000;
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init,
      signal: AbortSignal.timeout(Math.max(1, Math.min(4000, deadline - Date.now()))),
    }) },
  });
  try {
    const summary = await cleanupUploads(client, { dryRun: false, limit: 100, maxDurationMs: 14000 });
    console.log("Upload cleanup counts", JSON.stringify(summary));
    if (summary.examined < summary.eligible || summary.eligible === 100) {
      console.warn("Upload cleanup backlog remains; use Run now or the local cleanup command to drain it.");
    }
    if (summary.failed) throw new Error("Some upload cleanup work needs another attempt.");
  } catch {
    throw new Error("Upload cleanup needs attention. Inspect configuration and retry the scheduled function.");
  }
}

export const config = { schedule: "@hourly" };

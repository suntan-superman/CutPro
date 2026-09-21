import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { cleanupUploads } from "./lib/cleanup-uploads.mjs";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const argumentsList = process.argv.slice(2);
if (argumentsList.some((argument) => !["--execute", "--dry-run"].includes(argument))
  || (argumentsList.includes("--execute") && argumentsList.includes("--dry-run"))) {
  console.error("Usage: node scripts/cleanup-uploads.mjs [--dry-run | --execute]");
  process.exitCode = 1;
} else {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secret) throw new Error("Cleanup requires existing server configuration.");
    const client = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
    });
    const summary = await cleanupUploads(client, {
      dryRun: !argumentsList.includes("--execute"), limit: 50, maxDurationMs: 45000,
    });
    // Counts only: signed URLs, capabilities, credentials, and customer data
    // must never enter operation logs.
    console.log(JSON.stringify(summary));
    if (summary.failed) process.exitCode = 1;
  } catch {
    console.error("Upload cleanup could not finish. Check server configuration and the migration; no credentials were logged.");
    process.exitCode = 1;
  }
}

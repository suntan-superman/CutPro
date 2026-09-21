import { randomUUID } from "node:crypto";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_PATTERN = new RegExp(`^${UUID}$`);
const LEASE_MS = 10 * 60 * 1000;

// Build a deletion allowlist exclusively from the private durable ledger.
// Never enumerate a bucket, accept caller paths, or delete a whole prefix.
export function getUploadCleanupPlan(session) {
  if (!UUID_PATTERN.test(session?.id || "")
    || !["gallery", "estimate"].includes(session.purpose)
    || !Array.isArray(session.files) || session.files.length > 6) {
    throw new Error("Invalid upload cleanup ledger.");
  }
  const gallery = session.purpose === "gallery";
  const inputPattern = new RegExp(`^staging/${session.id}/${UUID}\\.(jpg|jpeg|png|webp${gallery ? "" : "|heic|heif"})$`);
  const outputPattern = new RegExp(gallery
    ? `^direct/${session.id}/${UUID}\\.webp$`
    : `^${session.id}/${UUID}\\.(jpg|jpeg|png|webp|heic|heif)$`);
  const finalized = Boolean(session.completed_at || session.result);
  const sources = [];
  const outputs = [];
  for (const file of session.files) {
    if (!inputPattern.test(file?.path || "") || !outputPattern.test(file?.outputPath || "")) {
      throw new Error("Upload cleanup path is outside its session.");
    }
    sources.push(file.path);
    if (!finalized) outputs.push(file.outputPath);
  }
  return {
    finalized,
    groups: [
      { bucket: gallery ? "gallery-staging" : "lead-photos", paths: [...new Set(sources)] },
      { bucket: gallery ? "gallery-media" : "lead-photos", paths: [...new Set(outputs)] },
    ].filter((group) => group.paths.length > 0),
  };
}

export async function cleanupUploads(client, {
  dryRun = true,
  limit = 20,
  now = new Date(),
  maxDurationMs = 20000,
} = {}) {
  if (!client || !Number.isInteger(limit) || limit < 1 || limit > 100
    || !Number.isFinite(now.getTime()) || !Number.isFinite(maxDurationMs) || maxDurationMs < 1) {
    throw new Error("Invalid upload cleanup configuration.");
  }
  const started = Date.now();
  const current = now.toISOString();
  const leaseCutoff = new Date(now.getTime() - LEASE_MS).toISOString();
  const { data: sessions, error } = await client.from("upload_sessions")
    .select("id,purpose,files,status,cleanup_after,lock_token,locked_at,result,completed_at")
    .neq("status", "cleaned")
    .lt("cleanup_after", current)
    .or(`locked_at.is.null,locked_at.lt.${leaseCutoff}`)
    .order("cleanup_after", { ascending: true })
    .limit(limit);
  if (error) throw new Error("The upload cleanup ledger could not be read.");
  const summary = { dryRun, examined: 0, eligible: sessions.length, cleaned: 0, failed: 0, skipped: 0, objects: 0 };
  for (const session of sessions) {
    if (Date.now() - started >= maxDurationMs) break;
    summary.examined += 1;
    let plan;
    try {
      plan = getUploadCleanupPlan(session);
    } catch {
      summary.failed += 1;
      continue;
    }
    if (dryRun) {
      summary.objects += plan.groups.reduce((count, group) => count + group.paths.length, 0);
      continue;
    }

    const token = randomUUID();
    let claim = client.from("upload_sessions").update({
      status: "cleaning", lock_token: token, locked_at: new Date().toISOString(),
    }).eq("id", session.id).eq("status", session.status).lt("cleanup_after", current)
      .or(`locked_at.is.null,locked_at.lt.${leaseCutoff}`);
    claim = session.lock_token ? claim.eq("lock_token", session.lock_token) : claim.is("lock_token", null);
    const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
    if (claimError) { summary.failed += 1; continue; }
    if (!claimed) { summary.skipped += 1; continue; }
    try {
      for (const group of plan.groups) {
        const { error: removeError } = await client.storage.from(group.bucket).remove(group.paths);
        if (removeError) throw new Error("Temporary upload removal failed.");
        summary.objects += group.paths.length;
      }
      const { data: finished, error: finishError } = await client.from("upload_sessions")
        .update({
          status: "cleaned", lock_token: null, locked_at: null, payload: {},
          files: session.files.map((file) => Object.fromEntries(
            Object.entries(file).filter(([key]) => key !== "authorization"),
          )),
        })
        .eq("id", session.id).eq("status", "cleaning").eq("lock_token", token)
        .select("id").maybeSingle();
      if (finishError || !finished) throw new Error("Upload cleanup completion could not be recorded.");
      summary.cleaned += 1;
    } catch {
      // Preserve the ledger and cached result so interrupted/partial removals
      // retry safely. A process crash leaves a reclaimable ten-minute lease.
      await client.from("upload_sessions")
        .update({ status: plan.finalized ? "complete" : "open", lock_token: null, locked_at: null })
        .eq("id", session.id).eq("status", "cleaning").eq("lock_token", token);
      summary.failed += 1;
    }
  }
  return summary;
}

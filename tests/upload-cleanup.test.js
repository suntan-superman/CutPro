import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cleanupUploads, getUploadCleanupPlan } from "../scripts/lib/cleanup-uploads.mjs";

function session({ purpose = "estimate", finalized = false, ...overrides } = {}) {
  const id = randomUUID();
  const fileId = randomUUID();
  return {
    id, purpose, status: finalized ? "complete" : "open",
    cleanup_after: new Date(Date.now() - 60000).toISOString(),
    lock_token: null, locked_at: null,
    result: finalized ? { ok: true, reference: "CP-TEST", duplicate: false } : null,
    completed_at: finalized ? new Date(Date.now() - 120000).toISOString() : null,
    files: [{
      id: fileId,
      path: `staging/${id}/${fileId}.jpg`,
      outputPath: purpose === "gallery" ? `direct/${id}/${fileId}.webp` : `${id}/${fileId}.jpg`,
      state: finalized ? "ready" : "pending",
    }],
    ...overrides,
  };
}

function fakeClient(rows, { failRemoval = false, beforeClaim } = {}) {
  const removals = [];
  const updates = [];
  class Query {
    constructor() { this.filters = []; this.count = 100; }
    select() { return this; }
    eq(field, value) { this.filters.push((row) => row[field] === value); return this; }
    neq(field, value) { this.filters.push((row) => row[field] !== value); return this; }
    is(field, value) { return this.eq(field, value); }
    lt(field, value) { this.filters.push((row) => row[field] < value); return this; }
    or(expression) {
      const cutoff = expression.split("locked_at.lt.")[1];
      this.filters.push((row) => row.locked_at === null || row.locked_at < cutoff);
      return this;
    }
    order() { return this; }
    limit(value) { this.count = value; return this; }
    update(patch) { this.patch = patch; return this; }
    maybeSingle() { this.single = true; return this; }
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        if (this.patch?.status === "cleaning") beforeClaim?.(rows);
        const matched = rows.filter((row) => this.filters.every((filter) => filter(row))).slice(0, this.count);
        if (this.patch) {
          updates.push(this.patch);
          matched.forEach((row) => Object.assign(row, this.patch));
        }
        const data = structuredClone(matched);
        return { data: this.single ? data[0] || null : data, error: null };
      }).then(resolve, reject);
    }
  }
  return {
    from(table) { assert.equal(table, "upload_sessions"); return new Query(); },
    storage: { from(bucket) {
      return { async remove(paths) {
        removals.push({ bucket, paths });
        return { error: failRemoval ? { message: "Synthetic storage failure" } : null };
      } };
    } },
    removals, updates,
  };
}

test("completed estimate cleanup deletes only its temporary sources", () => {
  const row = session({ finalized: true });
  const plan = getUploadCleanupPlan(row);
  assert.equal(plan.finalized, true);
  assert.deepEqual(plan.groups, [{ bucket: "lead-photos", paths: [row.files[0].path] }]);
});

test("incomplete gallery cleanup includes only its private source and tracked normalized output", () => {
  const row = session({ purpose: "gallery" });
  assert.deepEqual(getUploadCleanupPlan(row).groups, [
    { bucket: "gallery-staging", paths: [row.files[0].path] },
    { bucket: "gallery-media", paths: [row.files[0].outputPath] },
  ]);
});

test("a preserved result protects final photos even while status is cleaning", () => {
  const row = session({ finalized: true, status: "cleaning", completed_at: null });
  assert.equal(getUploadCleanupPlan(row).groups.length, 1);
});

test("cleanup rejects another submission's paths, traversal, missing paths, and excess count", () => {
  for (const replacement of [
    `staging/${randomUUID()}/${randomUUID()}.jpg`,
    "staging/../../lead-photos/real-customer.jpg",
    "",
  ]) {
    const row = session();
    row.files[0].path = replacement;
    assert.throws(() => getUploadCleanupPlan(row), /outside its session/);
  }
  const row = session();
  row.files = Array(7).fill(row.files[0]);
  assert.throws(() => getUploadCleanupPlan(row), /Invalid upload cleanup ledger/);
});

test("cleanup defaults to read-only dry run", async () => {
  const row = session();
  const client = fakeClient([row]);
  const summary = await cleanupUploads(client);
  assert.equal(summary.dryRun, true);
  assert.equal(summary.objects, 2);
  assert.equal(summary.cleaned, 0);
  assert.equal(client.updates.length, 0);
  assert.equal(client.removals.length, 0);
  assert.equal(row.status, "open");
});

test("cleanup preserves final result and photos for idempotent final-submit retries", async () => {
  const row = session({ finalized: true });
  row.payload = { firstName: "Synthetic Customer" };
  row.files[0].authorization = { token: "synthetic-signed-upload-token" };
  const originalResult = structuredClone(row.result);
  const client = fakeClient([row]);
  const summary = await cleanupUploads(client, { dryRun: false });
  assert.equal(summary.cleaned, 1);
  assert.equal(row.status, "cleaned");
  assert.deepEqual(row.result, originalResult);
  assert.equal(row.lock_token, null);
  assert.deepEqual(row.payload, {});
  assert.equal("authorization" in row.files[0], false);
  assert.deepEqual(client.removals, [{ bucket: "lead-photos", paths: [row.files[0].path] }]);
});

test("cleanup cannot race an active processing lease or unexpired upload authority", async () => {
  const active = session({ status: "processing", lock_token: randomUUID(), locked_at: new Date().toISOString() });
  const future = session({ cleanup_after: new Date(Date.now() + 60000).toISOString() });
  const client = fakeClient([active, future]);
  const summary = await cleanupUploads(client, { dryRun: false });
  assert.equal(summary.eligible, 0);
  assert.equal(client.removals.length, 0);
});

test("stale crashed processing leases are reclaimed and all abandoned paths cleaned", async () => {
  const row = session({ status: "processing", lock_token: randomUUID(), locked_at: new Date(Date.now() - 11 * 60000).toISOString() });
  const client = fakeClient([row]);
  const summary = await cleanupUploads(client, { dryRun: false });
  assert.equal(summary.cleaned, 1);
  assert.equal(row.status, "cleaned");
  assert.equal(client.removals.length, 2);
});

test("storage cleanup failures retain a retryable ledger and never erase a cached success", async () => {
  const row = session({ finalized: true });
  const originalResult = structuredClone(row.result);
  const client = fakeClient([row], { failRemoval: true });
  const summary = await cleanupUploads(client, { dryRun: false });
  assert.equal(summary.failed, 1);
  assert.equal(row.status, "complete");
  assert.equal(row.lock_token, null);
  assert.deepEqual(row.result, originalResult);
});

test("a concurrent state change makes cleanup skip instead of deleting files", async () => {
  const row = session();
  const client = fakeClient([row], { beforeClaim(rows) {
    rows[0].status = "processing";
    rows[0].lock_token = randomUUID();
    rows[0].locked_at = new Date().toISOString();
  } });
  const summary = await cleanupUploads(client, { dryRun: false });
  assert.equal(summary.skipped, 1);
  assert.equal(client.removals.length, 0);
});

test("malformed durable paths fail closed without removing other valid files", async () => {
  const row = session();
  row.files.push({ ...row.files[0], outputPath: `another-customer/${randomUUID()}.jpg` });
  const client = fakeClient([row]);
  const summary = await cleanupUploads(client, { dryRun: false });
  assert.equal(summary.failed, 1);
  assert.equal(client.removals.length, 0);
  assert.equal(row.status, "open");
});

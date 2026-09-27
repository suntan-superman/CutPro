import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { adminLeadDeleteHandlers, deleteLeadRecord, getLeadPhotoPaths, getLeadUploadPaths } from "../src/lib/adminLeadDeletion.js";

const leadId = randomUUID();
const photoId = randomUUID();
const photoPath = `${leadId}/${photoId}.jpg`;
const stagedPhotoPath = `staging/${leadId}/${photoId}.jpg`;

function fakeClient({ row = { id: leadId, photo_references: [{ path: photoPath }] }, session = { files: [{ path: stagedPhotoPath, outputPath: photoPath }] }, readError = null, storageError = null, deleteError = null } = {}) {
  const calls = { removed: [], deleted: false };
  const from = (table) => {
    let operation = "";
    const chain = {
      select() { operation = "select"; return chain; },
      delete() { operation = "delete"; return chain; },
      eq() {
        if (operation === "delete") return Promise.resolve({ error: deleteError });
        return chain;
      },
      async maybeSingle() { return { data: row, error: readError }; },
    };
    if (table === "leads") return chain;
    if (table === "upload_sessions") {
      chain.maybeSingle = async () => ({ data: session, error: readError });
      return chain;
    }
    throw new Error(`Unexpected table: ${table}`);
  };
  return {
    calls,
    from,
    storage: { from(bucket) { assert.equal(bucket, "lead-photos"); return { remove: async (paths) => { calls.removed.push(paths); return { error: storageError }; } }; } },
  };
}

test("lead photo paths only accept final private UUID paths", () => {
  assert.deepEqual(getLeadPhotoPaths([{ path: photoPath }, { path: photoPath }]), { valid: true, paths: [photoPath] });
  assert.deepEqual(getLeadUploadPaths([{ path: stagedPhotoPath, outputPath: photoPath }]), { valid: true, paths: [stagedPhotoPath, photoPath] });
  assert.equal(getLeadPhotoPaths([{ path: "../other-bucket/file.jpg" }]).valid, false);
  assert.equal(getLeadPhotoPaths([{ path: `${leadId}/not-a-uuid.jpg` }]).valid, false);
  assert.equal(getLeadPhotoPaths([]).valid, true);
});

test("deleting a lead removes its private photos before the database row", async () => {
  const client = fakeClient();
  const result = await deleteLeadRecord(client, leadId);
  assert.deepEqual(result, { ok: true, status: 200 });
  assert.deepEqual(client.calls.removed, [[photoPath, stagedPhotoPath]]);
});

test("storage failure keeps the lead available for retry", async () => {
  const client = fakeClient({ storageError: new Error("storage unavailable") });
  const result = await deleteLeadRecord(client, leadId);
  assert.equal(result.status, 500);
  assert.match(result.message, /private photos could not be removed/);
});

test("malformed stored photo paths fail closed", async () => {
  const client = fakeClient({ row: { id: leadId, photo_references: [{ path: "unsafe/path.jpg" }] } });
  const result = await deleteLeadRecord(client, leadId);
  assert.equal(result.status, 500);
  assert.match(result.message, /safely removed/);
  assert.deepEqual(client.calls.removed, []);
});

test("malformed upload ledger paths fail closed", async () => {
  const client = fakeClient({ session: { files: [{ path: "staging/unsafe/file.jpg", outputPath: photoPath }] } });
  const result = await deleteLeadRecord(client, leadId);
  assert.equal(result.status, 500);
  assert.match(result.message, /safely removed/);
  assert.deepEqual(client.calls.removed, []);
});

test("unauthorized delete requests never create a storage client", async () => {
  let created = false;
  const handlers = adminLeadDeleteHandlers({
    authorize: async () => ({ ok: false, status: 401, message: "Sign in is required." }),
    createClient: () => { created = true; return fakeClient(); },
  });
  const response = await handlers.DELETE(new Request("https://cutpro.example/api/admin/leads/x", { method: "DELETE" }), { params: Promise.resolve({ id: leadId }) });
  assert.equal(response.status, 401);
  assert.equal(created, false);
});

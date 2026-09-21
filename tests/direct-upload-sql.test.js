import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

let database;
before(async () => {
  database = new PGlite();
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create schema storage;
    create table storage.buckets (
      id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
  `);
  const schema = (await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"))
    .replace(/^create extension if not exists pgcrypto;\s*$/m, "");
  await database.exec(schema);
  // Hosted Supabase automatically grants server access to application tables.
  await database.exec("grant select, insert, update, delete on all tables in schema public to service_role;");
  const migration = await readFile(new URL("../supabase/migrations/20260921_direct_uploads.sql", import.meta.url), "utf8");
  await database.exec(migration);
  await database.exec(migration);
});
after(async () => { await database?.close(); });

async function asRole(role, callback) {
  assert.ok(["anon", "authenticated", "service_role"].includes(role));
  await database.exec(`set role ${role}`);
  try { return await callback(); }
  finally { await database.exec("reset role"); }
}

async function makeSession({ purpose = "estimate", count = 1, state = "ready", expired = false } = {}) {
  const id = randomUUID();
  const lock = randomUUID();
  const files = Array.from({ length: count }, () => {
    const fileId = randomUUID();
    const outputPath = purpose === "gallery" ? `direct/${id}/${fileId}.webp` : `${id}/${fileId}.jpg`;
    return {
      id: fileId, name: "synthetic-image.jpg", type: "image/jpeg", size: 100,
      path: `staging/${id}/${fileId}.jpg`, outputPath, state,
      reference: purpose === "gallery"
        ? { storage_path: outputPath, public_url: `https://example.invalid/${outputPath}` }
        : { path: outputPath, originalName: "synthetic-image.jpg", originalType: "image/jpeg", originalSize: 100, storedType: "image/jpeg", storedSize: 100 },
    };
  });
  await database.query(`
    insert into public.upload_sessions
      (id, purpose, owner_id, token_hash, files, status, lock_token, locked_at, expires_at)
    values ($1, $2, $3, $4, $5::jsonb, 'processing', $6, now(), $7)
  `, [id, purpose, purpose === "gallery" ? randomUUID() : null, "a".repeat(64), JSON.stringify(files), lock,
    new Date(Date.now() + (expired ? -60000 : 30 * 60000)).toISOString()]);
  return { id, lock, files, purpose };
}

function leadRecord(session) {
  return {
    id: session.id, reference: `QA-${randomUUID()}`, submission_token: session.id,
    first_name: "Synthetic", last_name: "SQL Test", phone: "6615550100",
    email: "cutpro-qa@example.invalid", property_address: "Synthetic SQL fixture only",
    city: "Bakersfield", zip: "93301", services: ["Tree Removal"],
    urgency: "Flexible", job_description: "Synthetic fixture; not a customer lead",
    preferred_contact_method: "Phone", photo_references: session.files.map((file) => file.reference),
  };
}

function galleryRecords(session) {
  return session.files.map((file) => ({
    ...file.reference, alt_text: "Synthetic SQL test photo", caption: "Not customer media",
    category: "Other", featured: false, published: false, sort_order: 0,
  }));
}

async function finalize(session, { lead = null, gallery = null, lock = session.lock } = {}) {
  return asRole("service_role", async () => {
    const result = await database.query(`
      select public.finalize_upload_session($1, $2, $3::jsonb, $4::jsonb) as result
    `, [session.id, lock, lead && JSON.stringify(lead), gallery && JSON.stringify(gallery)]);
    return result.rows[0].result;
  });
}

async function rowCount(table, id, column = "id") {
  assert.ok(["leads", "gallery_items"].includes(table));
  assert.ok(["id", "storage_path"].includes(column));
  const result = await database.query(`select count(*)::integer as count from public.${table} where ${column} = $1`, [id]);
  return result.rows[0].count;
}

test("direct-upload migration applies twice and preserves existing bucket visibility and limits", async () => {
  const buckets = await database.query("select id, public, file_size_limit::integer from storage.buckets order by id");
  assert.deepEqual(buckets.rows, [
    { id: "gallery-media", public: true, file_size_limit: 8388608 },
    { id: "gallery-staging", public: false, file_size_limit: 8388608 },
    { id: "lead-photos", public: false, file_size_limit: 8388608 },
  ]);
  const functions = await database.query("select proname, prosecdef from pg_proc where proname in ('consume_upload_budget', 'finalize_upload_session') order by proname");
  assert.deepEqual(functions.rows, [
    { proname: "consume_upload_budget", prosecdef: false },
    { proname: "finalize_upload_session", prosecdef: false },
  ]);
});

test("anonymous and authenticated browsers cannot read upload ledgers or invoke server RPCs", async () => {
  for (const role of ["anon", "authenticated"]) {
    await asRole(role, async () => {
      await assert.rejects(database.query("select * from public.upload_sessions"), { code: "42501" });
      await assert.rejects(database.query("select public.consume_upload_budget('fixture', 5, 900)"), { code: "42501" });
      await assert.rejects(database.query("select public.finalize_upload_session($1, $2)", [randomUUID(), randomUUID()]), { code: "42501" });
    });
  }
});

test("RLS independently prevents browser ledger reads even if a table read grant is accidentally added", async () => {
  await makeSession();
  await database.exec("grant select on public.upload_sessions to anon");
  try {
    await asRole("anon", async () => {
      const result = await database.query("select * from public.upload_sessions");
      assert.deepEqual(result.rows, []);
    });
  } finally { await database.exec("revoke select on public.upload_sessions from anon"); }
});

test("durable upload budget atomically permits the limit and rejects excess requests", async () => {
  const key = `estimate:${randomUUID()}`;
  const results = await asRole("service_role", () => Promise.all(Array.from({ length: 8 }, () => (
    database.query("select public.consume_upload_budget($1, 5, 900) as allowed", [key])
  ))));
  assert.equal(results.filter((result) => result.rows[0].allowed).length, 5);
  await asRole("service_role", () => assert.rejects(
    database.query("select public.consume_upload_budget($1, 0, 900)", [key]), { code: "22023" },
  ));
});

test("estimate finalization persists one lead and cached retries remain idempotent after cleanup", async () => {
  const session = await makeSession({ count: 2 });
  const lead = leadRecord(session);
  const first = await finalize(session, { lead });
  assert.deepEqual(first, { ok: true, reference: lead.reference, duplicate: false });
  const second = await finalize(session, { lead });
  assert.deepEqual(second, { ...first, duplicate: true });
  assert.equal(await rowCount("leads", session.id), 1);
  await database.query("update public.upload_sessions set status = 'cleaned', payload = '{}'::jsonb where id = $1", [session.id]);
  assert.deepEqual(await finalize(session, { lock: null }), second);
  const saved = await database.query("select photo_references from public.leads where id = $1", [session.id]);
  assert.deepEqual(saved.rows[0].photo_references, lead.photo_references);
});

test("an estimate with zero photos finalizes without a binary upload or duplicate lead", async () => {
  const session = await makeSession({ count: 0 });
  const result = await finalize(session, { lead: leadRecord(session) });
  assert.equal(result.ok, true);
  assert.equal(await rowCount("leads", session.id), 1);
});

test("gallery finalization inserts an atomic batch and retries return the same rows", async () => {
  const session = await makeSession({ purpose: "gallery", count: 2 });
  const gallery = galleryRecords(session);
  const first = await finalize(session, { gallery });
  assert.equal(first.ok, true);
  assert.equal(first.count, 2);
  assert.equal(first.items.length, 2);
  const second = await finalize(session, { gallery });
  assert.equal(second.duplicate, true);
  assert.deepEqual(second.items, first.items);
  for (const row of gallery) assert.equal(await rowCount("gallery_items", row.storage_path, "storage_path"), 1);
});

test("one invalid gallery row rolls back the entire batch and leaves its session retryable", async () => {
  const session = await makeSession({ purpose: "gallery", count: 2 });
  const gallery = galleryRecords(session);
  gallery[1].alt_text = null;
  await assert.rejects(finalize(session, { gallery }), { code: "23502" });
  for (const row of gallery) assert.equal(await rowCount("gallery_items", row.storage_path, "storage_path"), 0);
  const state = await database.query("select status, result from public.upload_sessions where id = $1", [session.id]);
  assert.deepEqual(state.rows[0], { status: "processing", result: null });
  assert.equal((await finalize(session, { gallery: galleryRecords(session) })).count, 2);
});

test("another submission's photo cannot be attached to a lead", async () => {
  const session = await makeSession();
  const other = await makeSession();
  const lead = leadRecord(session);
  lead.photo_references = [other.files[0].reference];
  await assert.rejects(finalize(session, { lead }), { code: "22023" });
  assert.equal(await rowCount("leads", session.id), 0);
});

test("repeated references cannot masquerade as the session's complete photo set", async () => {
  const session = await makeSession({ count: 2 });
  const lead = leadRecord(session);
  lead.photo_references[1] = lead.photo_references[0];
  await assert.rejects(finalize(session, { lead }), { code: "22023" });
  assert.equal(await rowCount("leads", session.id), 0);
});

test("expired sessions, wrong locks, and unfinished files cannot finalize", async () => {
  const expired = await makeSession({ expired: true });
  await assert.rejects(finalize(expired, { lead: leadRecord(expired) }), { code: "55000" });
  const wrongLock = await makeSession();
  await assert.rejects(finalize(wrongLock, { lead: leadRecord(wrongLock), lock: randomUUID() }), { code: "55000" });
  const pending = await makeSession({ state: "pending" });
  await assert.rejects(finalize(pending, { lead: leadRecord(pending) }), { code: "22023" });
  for (const row of [expired, wrongLock, pending]) assert.equal(await rowCount("leads", row.id), 0);
});

test("six-photo database limit cannot be bypassed by adding a seventh durable slot", async () => {
  await assert.rejects(makeSession({ count: 7 }), { code: "23514" });
});

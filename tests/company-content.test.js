import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { defaultCompanyContent } from "../src/data/companyContent.js";
import { validateCompanyContent, readCompanyContent } from "../src/lib/companyContent.js";
import { companyContentHandlers } from "../src/lib/companyContentRoutes.js";

const actor = "11111111-1111-4111-8111-111111111111";
const authorized = async () => ({ ok: true, user: { id: actor } });
const payload = () => structuredClone(defaultCompanyContent);
const request = (input) => new Request("https://cutpro.example/api/admin/company", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });

test("company content rejects wrong types, missing fields, excessive text and HTML", () => {
  assert.equal(validateCompanyContent(payload()).valid, true);
  for (const input of [null, [], {}, { ...payload(), companyName: 10 }, { ...payload(), aboutHeading: " " }, { ...payload(), localParagraph: "x".repeat(2001) }, { ...payload(), aboutParagraphs: ["only one"] }, { ...payload(), aboutParagraphs: ["a", "b", {}, "d"] }, { ...payload(), companyName: "<script>alert(1)</script>" }]) assert.equal(validateCompanyContent(input).valid, false);
  assert.equal(validateCompanyContent({ ...payload(), companyName: "  CUTPRO & Team  ", updated_by: "forged" }).data.companyName, "CUTPRO & Team");
  assert.equal("updated_by" in validateCompanyContent({ ...payload(), updated_by: "forged" }).data, false);
});

test("public About defaults survive missing configuration, outage, corrupt data and missing table", async () => {
  for (const client of [null, { from() { throw new Error("network"); } }, fakeClient({ error: {} }), fakeClient({ data: { content: {} } })]) {
    const result = await readCompanyContent(client);
    assert.deepEqual(result.content, defaultCompanyContent);
    assert.equal(result.available, false);
  }
  assert.equal((await readCompanyContent(fakeClient({ data: null }))).available, true);
});

function fakeClient(result, saved = []) {
  return { from() { return {
    select() { return this; }, eq() { return this; }, maybeSingle: async () => result,
    upsert(value) { saved.push(value); return this; }, single: async () => result,
  }; } };
}

test("anonymous/nonadmin Company GET and PUT are denied before creating a privileged client", async () => {
  for (const status of [401, 403]) {
    const handlers = companyContentHandlers({ authorize: async () => ({ ok: false, status, message: "Denied" }), createClient() { assert.fail("Unauthorized storage access"); } });
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.PUT(request(payload()))).status, status);
  }
});

test("save uses server actor, bounded content and no-store; read failures block the editor", async () => {
  const saved = [];
  const content = { ...payload(), aboutHeading: "Updated company story" };
  const handlers = companyContentHandlers({ authorize: authorized, createClient: () => fakeClient({ data: { content, updated_at: "2026-09-22T00:00:00Z" } }, saved) });
  const response = await handlers.PUT(request({ ...content, updated_by: "forged", id: "another" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(saved[0], { id: "primary", content, updated_by: actor });
  assert.deepEqual((await response.json()).content, content);
  const unavailable = companyContentHandlers({ authorize: authorized, createClient: () => fakeClient({ error: {} }) });
  assert.equal((await unavailable.GET()).status, 503);
  assert.equal((await unavailable.PUT(request(content))).status, 503);
});

test("invalid, malformed and oversized Company requests never reach storage", async () => {
  const handlers = companyContentHandlers({ authorize: authorized, createClient() { assert.fail("Invalid write reached storage"); } });
  assert.equal((await handlers.PUT(request({}))).status, 422);
  assert.equal((await handlers.PUT(new Request("https://example.com", { method: "PUT", body: "not json" }))).status, 415);
  assert.equal((await handlers.PUT(new Request("https://example.com", { method: "PUT", headers: { "content-type": "application/json" }, body: "{" }))).status, 400);
  assert.equal((await handlers.PUT(request({ huge: "x".repeat(65537) }))).status, 413);
});

test("Company migration is repeatable, preserves content, timestamps edits, and blocks browser roles", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values ('${actor}');
      create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;`);
    const migration = await readFile(new URL("../supabase/migrations/20260922_company_content.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec("set role service_role");
    await db.query("insert into company_content (content, updated_by, updated_at) values ($1, $2, '2000-01-01')", [JSON.stringify(payload()), actor]);
    await db.exec("reset role");
    await db.exec(migration);
    assert.deepEqual((await db.query("select content from company_content")).rows[0].content, payload());
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from company_content"));
      await assert.rejects(db.query("update company_content set content = '{}'"));
      await db.exec("reset role");
    }
    // RLS remains a second boundary even if grants are mistakenly added later.
    await db.exec("grant select, update on company_content to authenticated; set role authenticated");
    assert.equal((await db.query("select * from company_content")).rows.length, 0);
    assert.equal((await db.query("update company_content set content = '{}' returning id")).rows.length, 0);
    await db.exec("reset role; set role service_role");
    const changed = { ...payload(), localHeading: "Bakersfield tree care" };
    const updated = (await db.query("update company_content set content = $1 where id = 'primary' returning *", [JSON.stringify(changed)])).rows[0];
    assert.deepEqual(updated.content, changed);
    assert.equal(updated.updated_by, actor);
    assert.ok(new Date(updated.updated_at) > new Date("2000-01-01"));
    await assert.rejects(db.query("insert into company_content (id, content) values ('second', '{}')"));
  } finally { await db.close(); }
});

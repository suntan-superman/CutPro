import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getSupabaseConfig,
  hasPublicSupabaseConfig,
  hasServerSupabaseConfig,
} from "../src/lib/supabase/config.js";

test("environment template contains no populated credentials", () => {
  const template = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const unexpectedValues = [];
  for (const line of template.split(/\r?\n/)) {
    const entry = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!entry) continue;
    const [, name, value] = entry;
    const expected = name === "NEXT_PUBLIC_SITE_URL" ? "http://localhost:3000" : "";
    if (value.trim() !== expected) unexpectedValues.push(name);
  }
  // Report variable names only: failed tests must not echo credential values.
  assert.deepEqual(unexpectedValues, [], "Keep real values out of .env.example");
});

test("modern Supabase keys are accepted and preferred", () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishable: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secret: process.env.SUPABASE_SECRET_KEY,
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "legacy_anon";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy_service_role";
    assert.equal(hasPublicSupabaseConfig(), true);
    assert.equal(hasServerSupabaseConfig(), true);
    assert.equal(getSupabaseConfig().publishableKey, "sb_publishable_test");
    assert.equal(getSupabaseConfig().secretKey, "sb_secret_test");
  } finally {
    for (const [name, value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: previous.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: previous.publishable,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: previous.anon,
      SUPABASE_SECRET_KEY: previous.secret,
      SUPABASE_SERVICE_ROLE_KEY: previous.serviceRole,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

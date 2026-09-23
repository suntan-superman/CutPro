import test from "node:test";
import assert from "node:assert/strict";
import { sendLeadNotifications } from "../src/lib/notificationCore.js";

const lead = {
  id: "qa-lead-id",
  reference: "CP-20260923-EMAILQA",
  created_at: "2026-09-23T19:00:00.000Z",
  first_name: "Workside",
  last_name: "Email QA",
  phone: "(213) 466-1363",
  email: "customer@example.com",
  property_address: "123 Synthetic QA Lane",
  city: "Bakersfield",
  zip: "93301",
  services: ["tree-removal"],
  urgency: "Flexible",
  job_description: "CUTPRO RESEND CERTIFICATION TEST — NOT A CUSTOMER LEAD",
  approximate_count: "1",
  preferred_timeframe: "Next month",
  preferred_contact_method: "Email",
  best_contact_time: "Weekdays after 3",
  customer_notes: "Synthetic notification fixture.",
  photo_references: [{ path: "lead-photos/private-object", originalName: "large-phone-photo.jpg" }],
};

function fakeResend({ ownerError = false, customerError = false, throwOwner = false } = {}) {
  const calls = [];
  return {
    calls,
    emails: {
      async send(payload) {
        calls.push(payload);
        if (calls.length === 1 && throwOwner) throw new Error("synthetic provider outage");
        if (calls.length === 1 && ownerError) return { data: null, error: { name: "provider_error" } };
        if (calls.length === 2 && customerError) return { data: null, error: { name: "provider_error" } };
        return { data: { id: `email-${calls.length}` }, error: null };
      },
    },
  };
}

const config = {
  apiKey: "synthetic-api-key",
  ownerEmail: "owner@example.com",
  from: "CutPro Tree Service <notifications@cutprotree.com>",
  replyTo: "reply@example.com",
};
const brand = {
  name: "CutPro Tree Service",
  phoneDisplay: "(213) 466-1363",
  phoneHref: "tel:+12134661363",
  canonicalUrl: "https://cutpro-tree-service.netlify.app",
};

test("owner and customer messages use the verified sender, optional Reply-To, and no private attachments", async () => {
  const resend = fakeResend();
  const result = await sendLeadNotifications(lead, { resendClient: resend, config, brand });
  assert.equal(result.sent, true);
  assert.equal(result.owner.sent, true);
  assert.equal(result.customer.sent, true);
  assert.equal(resend.calls.length, 2);
  for (const message of resend.calls) {
    assert.equal(message.from, config.from);
    assert.equal(message.replyTo, config.replyTo);
    assert.equal(message.attachments, undefined);
  }
  assert.equal(resend.calls[0].to, config.ownerEmail);
  assert.match(resend.calls[0].html, /CutPro Tree Service — New Estimate Request/);
  assert.match(resend.calls[0].html, /private photo\(s\) available in the admin portal/);
  assert.match(resend.calls[0].html, /admin\/leads\/qa-lead-id/);
  assert.doesNotMatch(resend.calls[0].html, /lead-photos\/private-object/);
  assert.equal(resend.calls[1].to, lead.email);
  assert.match(resend.calls[1].html, /This confirms receipt only/);
  assert.match(resend.calls[1].html, /cutprotree\.com/);
  assert.match(resend.calls[1].html, /\(213\) 466-1363/);
});

test("owner failure does not prevent the customer acknowledgement attempt", async () => {
  const resend = fakeResend({ throwOwner: true });
  const result = await sendLeadNotifications(lead, { resendClient: resend, config, brand });
  assert.equal(result.sent, false);
  assert.equal(result.owner.sent, false);
  assert.equal(result.owner.reason, "provider_unavailable");
  assert.equal(result.customer.sent, true);
  assert.equal(resend.calls.length, 2);
});

test("customer failure leaves the owner notification successful and does not throw", async () => {
  const resend = fakeResend({ customerError: true });
  const result = await sendLeadNotifications(lead, { resendClient: resend, config, brand });
  assert.equal(result.sent, false);
  assert.equal(result.owner.sent, true);
  assert.equal(result.customer.sent, false);
  assert.equal(result.customer.reason, "provider_rejected");
});

test("missing customer email still sends the owner notification", async () => {
  const resend = fakeResend();
  const result = await sendLeadNotifications({ ...lead, email: null }, { resendClient: resend, config, brand });
  assert.equal(result.sent, true);
  assert.equal(result.owner.sent, true);
  assert.deepEqual(result.customer, { sent: false, reason: "no_customer_email" });
  assert.equal(resend.calls.length, 1);
});

test("unconfigured email returns safely without attempting delivery", async () => {
  const resend = fakeResend();
  const result = await sendLeadNotifications(lead, { resendClient: resend, config: { apiKey: "", ownerEmail: "", from: "" }, brand });
  assert.equal(result.sent, false);
  assert.equal(result.reason, "not_configured");
  assert.equal(resend.calls.length, 0);
});

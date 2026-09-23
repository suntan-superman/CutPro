function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function detailRow(label, value) {
  if (!value) return "";
  const display = Array.isArray(value) ? value.join(", ") : value;
  return `<tr><th align="left" style="padding:7px 12px 7px 0;vertical-align:top">${escapeHtml(label)}</th><td style="padding:7px 0">${escapeHtml(display)}</td></tr>`;
}

async function attemptEmail(resend, payload) {
  try {
    const result = await resend.emails.send(payload);
    return {
      sent: !result?.error,
      id: result?.data?.id || null,
      reason: result?.error ? "provider_rejected" : null,
    };
  } catch {
    // Do not expose provider diagnostics, recipient data, or credentials to the
    // customer-facing route. Persistence has already completed at this point.
    return { sent: false, id: null, reason: "provider_unavailable" };
  }
}

export async function sendLeadNotifications(lead, { resendClient, config = {}, brand } = {}) {
  const apiKey = config.apiKey;
  const ownerEmail = config.ownerEmail;
  const from = config.from?.trim();
  const replyTo = config.replyTo?.trim();
  if (!apiKey || !ownerEmail || !from || !resendClient) {
    return {
      sent: false,
      reason: "not_configured",
      owner: { sent: false, reason: "not_configured" },
      customer: lead.email ? { sent: false, reason: "not_configured" } : { sent: false, reason: "no_customer_email" },
    };
  }
  const business = brand || { name: "CutPro Tree Service", phoneDisplay: "", phoneHref: "/contact", canonicalUrl: "http://localhost:3000" };
  const photoCount = lead.photo_references?.length || 0;
  const adminLeadUrl = new URL(`/admin/leads/${lead.id}`, business.canonicalUrl).toString();
  const common = { from, ...(replyTo ? { replyTo } : {}) };
  const rows = [
    detailRow("Reference", lead.reference),
    detailRow("Received", new Date(lead.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })),
    detailRow("Name", `${lead.first_name} ${lead.last_name}`.trim()),
    detailRow("Phone", lead.phone),
    detailRow("Email", lead.email),
    detailRow("Address", [lead.property_address, lead.city, lead.zip].filter(Boolean).join(", ")),
    detailRow("Services", lead.services),
    detailRow("Urgency", lead.urgency),
    detailRow("Description", lead.job_description),
    detailRow("Approx. count", lead.approximate_count),
    detailRow("Preferred timing", lead.preferred_timeframe),
    detailRow("Contact preference", [lead.preferred_contact_method, lead.best_contact_time].filter(Boolean).join(" — ")),
    detailRow("Customer notes", lead.customer_notes),
    detailRow("Photos", photoCount ? `${photoCount} private photo(s) available in the admin portal` : "None"),
  ].join("");

  const ownerResult = await attemptEmail(resendClient, {
    ...common,
    to: ownerEmail,
    subject: `New CutPro estimate request ${lead.reference}: ${lead.first_name} ${lead.last_name}`.trim(),
    html: `<h1>CutPro Tree Service — New Estimate Request</h1><table>${rows}</table><p><a href="${escapeHtml(adminLeadUrl)}">Open this lead in the CutPro admin portal</a> to manage follow-up and view private photos.</p>`,
  });

  let customerResult = { sent: false, reason: "no_customer_email" };
  if (lead.email) {
    customerResult = await attemptEmail(resendClient, {
      ...common,
      to: lead.email,
      subject: `${business.name} received your request (${lead.reference})`,
      html: `<p><strong>${business.name}</strong></p><p>Hi ${escapeHtml(lead.first_name)},</p><p>We received your estimate request and saved it as <strong>${escapeHtml(lead.reference)}</strong>. This confirms receipt only; it does not schedule an appointment or confirm availability.</p><p>Requested service: <strong>${escapeHtml(Array.isArray(lead.services) ? lead.services.join(", ") : lead.services)}</strong></p><p>CutPro will use the contact details you provided to follow up. If the situation changes or is urgent, call <a href="${business.phoneHref}">${business.phoneDisplay}</a>.</p><p>Website: cutprotree.com</p><p>Thank you,<br>${business.name}</p>`,
    });
  }
  return {
    sent: ownerResult.sent && (!lead.email || customerResult.sent),
    owner: ownerResult,
    customer: customerResult,
    // Keep the old names available to any operational tooling that may have
    // inspected them, without returning raw provider responses.
    ownerResult,
    customerResult,
  };
}

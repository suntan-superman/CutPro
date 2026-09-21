import "server-only";
import { Resend } from "resend";
import { business } from "@/data/business";

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

export async function sendLeadNotifications(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.LEAD_NOTIFICATION_EMAIL;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !ownerEmail || !from) return { sent: false, reason: "not_configured" };
  const resend = new Resend(apiKey);
  const photoCount = lead.photo_references?.length || 0;
  const adminLeadUrl = new URL(`/admin/leads/${lead.id}`, business.canonicalUrl).toString();
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

  const ownerResult = await resend.emails.send({
    from,
    to: ownerEmail,
    subject: `New CutPro lead ${lead.reference}: ${lead.first_name} ${lead.last_name}`.trim(),
    html: `<h1>New CutPro request</h1><table>${rows}</table><p><a href="${adminLeadUrl}">Open this lead in the CutPro admin portal</a> to manage follow-up and view private photos.</p>`,
  });

  let customerResult = null;
  if (lead.email) {
    customerResult = await resend.emails.send({
      from,
      to: lead.email,
      subject: `${business.name} received your request (${lead.reference})`,
      html: `<p>Hi ${escapeHtml(lead.first_name)},</p><p>We received your request and saved it as <strong>${escapeHtml(lead.reference)}</strong>. CutPro will use the contact details you provided to follow up.</p><p>If the situation changes or is urgent, call <a href="${business.phoneHref}">${business.phoneDisplay}</a>.</p><p>Thank you,<br>${business.name}</p>`,
    });
  }
  return { sent: !ownerResult.error, ownerResult, customerResult };
}

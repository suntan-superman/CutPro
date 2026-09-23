import "server-only";
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/adminAuthorization";
import { createServiceClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { checkRateLimit, getRequestIp, passesHoneypot, verifyTurnstile } from "@/lib/rateLimit";
import { sendLeadNotifications } from "@/lib/notifications";
import { UploadValidationError } from "@/lib/uploadValidation";
import { beginUploadSession, verifyUploadFile, finishUploadSession, readUploadJson, DirectUploadError } from "@/lib/directUploads";

const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { ...responseHeaders, ...(status === 429 ? { "Retry-After": "900" } : {}) } });
}

export async function handleDirectUpload(request, purpose, action) {
  let ownerId = null;
  if (purpose === "gallery") {
    const auth = await authorizeAdminRequest();
    if (!auth.ok) return json({ message: auth.message }, auth.status);
    ownerId = auth.user.id;
  }
  const client = createServiceClient({ timeoutMs: 8000 });
  if (!client) return json({ message: "Online uploads are being configured. Please call CutPro for now." }, 503);
  const ip = getRequestIp(request);
  const rate = checkRateLimit(`direct:${purpose}:${action}:${ip}`, { limit: action === "begin" ? 40 : 120, windowMs: 900_000 });
  if (!rate.allowed) return json({ message: "Too many requests. Please wait before trying again." }, 429);
  try {
    const input = await readUploadJson(request);
    const budgetKey = createHmac("sha256", getSupabaseConfig().secretKey).update(`${purpose}:${action}:${ip}`).digest("hex");
    if (action === "begin") {
      return json(await beginUploadSession(client, {
        input, purpose, ownerId, budgetKey,
        verifyNewSubmission: async () => purpose === "gallery" || (passesHoneypot(input.payload || {}) && await verifyTurnstile(input.payload?.turnstileToken, ip)),
      }));
    }
    if (action === "verify") {
      const { data: allowed, error } = await client.rpc("consume_upload_budget", { p_key: budgetKey, p_limit: purpose === "gallery" ? 200 : 60, p_window_seconds: 900 });
      if (error) throw new DirectUploadError("Photo storage is not ready. Please try later.", 503);
      if (!allowed) throw new DirectUploadError("Too many photo checks. Please wait before trying again.", 429);
      return json(await verifyUploadFile(client, { input, purpose, ownerId }));
    }
    const result = await finishUploadSession(client, { input, purpose, ownerId });
    let notificationStatus = null;
    if (purpose === "estimate" && !result.duplicate) {
      // Persist the lead and its references atomically BEFORE optional email.
      try {
        const { data: lead } = await client.from("leads").select("*").eq("id", input.sessionId).single();
        if (lead) {
          const notification = await sendLeadNotifications(lead);
          notificationStatus = {
            ownerSent: Boolean(notification.owner?.sent),
            customerSent: Boolean(notification.customer?.sent),
          };
        }
      } catch {
        // Never turn a persisted lead into a failed submission because email is
        // unavailable. Do not return provider diagnostics to the browser.
        notificationStatus = { ownerSent: false, customerSent: false };
      }
    }
    return json({ ...result, ...(notificationStatus ? { notificationStatus } : {}) });
  } catch (error) {
    if (error instanceof DirectUploadError) return json({ message: error.message }, error.status);
    if (error instanceof UploadValidationError) return json({ message: error.message }, 422);
    // SDK exceptions can contain signed URLs or private metadata: do not log them.
    console.error("Direct upload operation failed", { purpose, action });
    return json({ message: "The photo operation could not be completed. Please retry." }, 500);
  }
}

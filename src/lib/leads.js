import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadLeadPhotos } from "@/lib/uploads";
import { sendLeadNotifications } from "@/lib/notifications";

function leadReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `CP-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createLead(data, files = [], source = "estimate") {
  const client = createServiceClient();
  if (!client) throw new Error("Lead storage is not configured yet.");
  const record = {
    reference: leadReference(),
    submission_token: data.submissionToken,
    source,
    first_name: data.firstName,
    last_name: data.lastName || "",
    phone: data.phone,
    email: data.email || null,
    property_address: data.propertyAddress || null,
    city: data.city || null,
    zip: data.zip || null,
    services: data.services || (source === "contact" ? ["General question"] : []),
    urgency: data.urgency || null,
    job_description: data.jobDescription || data.message,
    approximate_count: data.approximateCount || null,
    preferred_timeframe: data.preferredTimeframe || null,
    preferred_contact_method: data.preferredContactMethod || null,
    best_contact_time: data.bestContactTime || null,
    customer_notes: data.customerNotes || null,
  };
  const { data: lead, error } = await client.from("leads").insert(record).select("*").single();
  if (error?.code === "23505") {
    const { data: existing } = await client.from("leads").select("*").eq("submission_token", data.submissionToken).single();
    if (existing) return { lead: existing, duplicate: true, notification: null };
  }
  if (error || !lead) throw new Error("Your request could not be saved.");

  let photoReferences = [];
  if (files.length) {
    try {
      photoReferences = await uploadLeadPhotos(lead.id, files);
      const { error: updateError } = await client
        .from("leads")
        .update({ photo_references: photoReferences })
        .eq("id", lead.id);
      if (updateError) {
        await client.storage
          .from("lead-photos")
          .remove(photoReferences.map((photo) => photo.path));
        throw new Error("The photos could not be attached to the saved request.");
      }
      lead.photo_references = photoReferences;
    } catch (uploadError) {
      lead.uploadWarning = uploadError.message;
    }
  }

  let notification;
  try {
    notification = await sendLeadNotifications(lead);
  } catch (emailError) {
    notification = { sent: false, reason: emailError.message };
  }
  return { lead, duplicate: false, notification };
}

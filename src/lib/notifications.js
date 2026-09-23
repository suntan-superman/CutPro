import "server-only";
import { Resend } from "resend";
import { business } from "@/data/business";
import { sendLeadNotifications as sendCore } from "@/lib/notificationCore";

export async function sendLeadNotifications(lead) {
  const config = {
    apiKey: process.env.RESEND_API_KEY,
    ownerEmail: process.env.LEAD_NOTIFICATION_EMAIL,
    from: process.env.EMAIL_FROM,
    replyTo: process.env.EMAIL_REPLY_TO,
  };
  let resendClient = null;
  if (config.apiKey && config.ownerEmail && config.from) {
    try {
      resendClient = new Resend(config.apiKey);
    } catch {
      resendClient = null;
    }
  }
  return sendCore(lead, { config, resendClient, brand: business });
}

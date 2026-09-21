import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads";
import { checkRateLimit, getRequestIp, passesHoneypot, verifyTurnstile } from "@/lib/rateLimit";
import { validateContact } from "@/lib/validation";

export async function POST(request) {
  const ip = getRequestIp(request);
  const rate = checkRateLimit(`contact:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rate.allowed) return NextResponse.json({ message: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  if (Number(request.headers.get("content-length") || 0) > 32 * 1024) return NextResponse.json({ message: "The message is too large." }, { status: 413 });
  try {
    const input = await request.json();
    if (!passesHoneypot(input)) return NextResponse.json({ message: "The request could not be verified." }, { status: 400 });
    if (!(await verifyTurnstile(input.turnstileToken, ip))) return NextResponse.json({ message: "Please complete the anti-spam check." }, { status: 400 });
    const validation = validateContact(input);
    if (!validation.valid) return NextResponse.json({ message: "Review the highlighted information.", errors: validation.errors }, { status: 422 });
    const result = await createLead(validation.data, "contact");
    return NextResponse.json({ ok: true, reference: result.lead.reference, duplicate: result.duplicate });
  } catch (error) {
    const setupError = error.message?.includes("not configured");
    if (!setupError) console.error("Contact submission failed", error);
    return NextResponse.json({ message: setupError ? "Online messages are being configured. Please call CutPro for now." : "Your message could not be saved. Please try again or call CutPro." }, { status: setupError ? 503 : 500 });
  }
}

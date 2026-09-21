import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads";
import { checkRateLimit, getRequestIp, passesHoneypot, verifyTurnstile } from "@/lib/rateLimit";
import { MAX_PHOTO_COUNT, MAX_PHOTO_SIZE, validateEstimate, validatePhoto } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const ip = getRequestIp(request);
  const rate = checkRateLimit(`estimate:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rate.allowed) return NextResponse.json({ message: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_PHOTO_SIZE * 4 + 256 * 1024) return NextResponse.json({ message: "The request is too large. Remove a few photos or choose smaller images." }, { status: 413 });
  try {
    const formData = await request.formData();
    let input;
    try { input = JSON.parse(String(formData.get("payload") || "{}")); }
    catch { return NextResponse.json({ message: "The request format was invalid." }, { status: 400 }); }
    if (!passesHoneypot(input)) return NextResponse.json({ message: "The request could not be verified." }, { status: 400 });
    if (!(await verifyTurnstile(input.turnstileToken, ip))) return NextResponse.json({ message: "Please complete the anti-spam check." }, { status: 400 });
    const validation = validateEstimate(input);
    if (!validation.valid) return NextResponse.json({ message: "Review the highlighted information.", errors: validation.errors }, { status: 422 });
    const files = formData.getAll("photos").filter((value) => value instanceof File && value.size > 0);
    if (files.length > MAX_PHOTO_COUNT) return NextResponse.json({ message: `Add no more than ${MAX_PHOTO_COUNT} photos.` }, { status: 422 });
    if (files.reduce((total, file) => total + file.size, 0) > MAX_PHOTO_SIZE * 4) return NextResponse.json({ message: "The combined photos are too large. Remove a few or choose smaller images." }, { status: 422 });
    for (const file of files) { const error = validatePhoto(file); if (error) return NextResponse.json({ message: error }, { status: 422 }); }
    const result = await createLead(validation.data, files, "estimate");
    return NextResponse.json({ ok: true, reference: result.lead.reference, duplicate: result.duplicate, photoWarning: result.lead.uploadWarning || null });
  } catch (error) {
    if (error.message?.includes("FormData")) return NextResponse.json({ message: "The request format was invalid." }, { status: 400 });
    const setupError = error.message?.includes("not configured");
    if (!setupError) console.error("Estimate submission failed", error);
    return NextResponse.json({ message: setupError ? "Online requests are being configured. Please call CutPro for now." : "Your request could not be saved. Please try again or call CutPro." }, { status: setupError ? 503 : 500 });
  }
}

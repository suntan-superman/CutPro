/** Display and dialing values always come from one configured number. */
export function getBusinessPhone(value) {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  const numeric = /^[+\d\s().-]+$/.test(raw);
  const us = numeric && ((!raw.startsWith("+") && digits.length === 10) || (digits.length === 11 && digits.startsWith("1")))
    ? digits.slice(-10) : null;
  const e164 = us ? `+1${us}` : numeric && raw.startsWith("+") && /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  return {
    phoneDisplay: us ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : raw,
    phoneHref: e164 || digits ? `tel:${e164 || raw.replace(/[^\d+]/g, "")}` : "/contact",
    phoneE164: e164,
  };
}

/** Format a customer-facing phone field while preserving server-side validation. */
export function formatPhoneInput(value) {
  const input = String(value ?? "");
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (input.trimStart().startsWith("+") || digits.length > 10) return `+${digits.slice(0, 15)}`;
  const limited = digits.slice(0, 10);
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

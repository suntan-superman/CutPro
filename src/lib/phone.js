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

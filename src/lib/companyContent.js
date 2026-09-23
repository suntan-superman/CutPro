import { defaultCompanyContent, companyContentLimits } from "../data/companyContent.js";

export function validateCompanyContent(input) {
  const errors = {};
  const data = {};
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  function text(value, key, max) {
    if (typeof value !== "string" || !value.trim()) {
      errors[key] = "Enter text for this field.";
      return "";
    }
    const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (!cleaned) errors[key] = "Enter text for this field.";
    else if (cleaned.length > max) errors[key] = `Use ${max} characters or fewer.`;
    else if (/<[^>]*>/.test(cleaned)) errors[key] = "Use plain text without HTML tags.";
    return cleaned;
  }
  for (const [key, max] of Object.entries(companyContentLimits)) {
    if (key === "aboutParagraphs") {
      if (!Array.isArray(source[key]) || source[key].length !== 4) errors[key] = "Provide all four About paragraphs.";
      data[key] = Array.from({ length: 4 }, (_, index) => text(source[key]?.[index], `aboutParagraph${index + 1}`, max));
    } else data[key] = text(source[key], key, max);
  }
  return { valid: Object.keys(errors).length === 0, data, errors };
}

// Public content has a bounded read and always falls back to confirmed copy.
// Admin callers also get availability, so a failed load cannot silently overwrite saved text.
export async function readCompanyContent(client) {
  const fallback = { content: structuredClone(defaultCompanyContent), updatedAt: null };
  if (!client) return { ...fallback, available: false };
  try {
    const { data, error } = await client.from("company_content")
      .select("content, updated_at").eq("id", "primary").maybeSingle();
    if (error) return { ...fallback, available: false };
    if (!data) return { ...fallback, available: true };
    const validated = validateCompanyContent(data.content);
    if (!validated.valid) return { ...fallback, available: false };
    return { content: validated.data, updatedAt: data.updated_at, available: true };
  } catch {
    return { ...fallback, available: false };
  }
}

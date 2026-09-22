import { estimateServiceOptions } from "../data/services.js";
import { LEAD_STATUSES, GALLERY_CATEGORIES, TESTIMONIAL_SOURCES } from "../data/adminOptions.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_PATTERN = /^https?:\/\//i;

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const GALLERY_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_SIZE = 8 * 1024 * 1024;
export const MAX_PHOTO_COUNT = 6;

export function cleanText(value, max = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

export function normalizePhone(value) {
  return cleanText(value, 30).replace(/[^\d+()\- .]/g, "");
}

export function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function validateEstimate(input) {
  const allowedServices = new Set(estimateServiceOptions.map((item) => item.value));
  const services = Array.isArray(input.services)
    ? [...new Set(input.services.map((value) => cleanText(value, 60)).filter((value) => allowedServices.has(value)))]
    : [];
  const data = {
    submissionToken: cleanText(input.submissionToken, 36),
    firstName: cleanText(input.firstName, 80),
    lastName: cleanText(input.lastName, 80),
    phone: normalizePhone(input.phone),
    email: cleanText(input.email, 160).toLowerCase(),
    propertyAddress: cleanText(input.propertyAddress, 180),
    city: cleanText(input.city, 100),
    zip: cleanText(input.zip, 12),
    services,
    urgency: cleanText(input.urgency, 50),
    jobDescription: cleanText(input.jobDescription, 2000),
    approximateCount: cleanText(input.approximateCount, 50),
    preferredTimeframe: cleanText(input.preferredTimeframe, 100),
    preferredContactMethod: cleanText(input.preferredContactMethod, 30),
    bestContactTime: cleanText(input.bestContactTime, 100),
    customerNotes: cleanText(input.customerNotes, 1000),
  };
  const errors = {};
  if (!UUID_PATTERN.test(data.submissionToken)) errors.submissionToken = "Please refresh and try again.";
  if (!data.firstName) errors.firstName = "Enter your first name.";
  if (!isValidPhone(data.phone)) errors.phone = "Enter a valid phone number.";
  if (data.email && !EMAIL_PATTERN.test(data.email)) errors.email = "Enter a valid email address.";
  if (!data.propertyAddress) errors.propertyAddress = "Enter the property address.";
  if (!data.city) errors.city = "Enter the city.";
  if (!/^\d{5}(?:-\d{4})?$/.test(data.zip)) errors.zip = "Enter a valid ZIP code.";
  if (!data.services.length) errors.services = "Choose at least one service.";
  if (!data.urgency) errors.urgency = "Choose an urgency.";
  if (data.jobDescription.length < 10) errors.jobDescription = "Add a short description of the work.";
  if (!data.preferredContactMethod) errors.preferredContactMethod = "Choose how you prefer to be contacted.";
  return { valid: Object.keys(errors).length === 0, data, errors };
}

export function validateContact(input) {
  const data = {
    submissionToken: cleanText(input.submissionToken, 36),
    firstName: cleanText(input.firstName, 80),
    lastName: cleanText(input.lastName, 80),
    phone: normalizePhone(input.phone),
    email: cleanText(input.email, 160).toLowerCase(),
    message: cleanText(input.message, 2000),
  };
  const errors = {};
  if (!UUID_PATTERN.test(data.submissionToken)) errors.submissionToken = "Please refresh and try again.";
  if (!data.firstName) errors.firstName = "Enter your first name.";
  if (!isValidPhone(data.phone)) errors.phone = "Enter a valid phone number.";
  if (data.email && !EMAIL_PATTERN.test(data.email)) errors.email = "Enter a valid email address.";
  if (data.message.length < 10) errors.message = "Tell us how we can help.";
  return { valid: Object.keys(errors).length === 0, data, errors };
}

export function validatePhoto(file, { gallery = false } = {}) {
  const types = gallery ? GALLERY_PHOTO_TYPES : PHOTO_TYPES;
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
  const allowedExtensions = gallery
    ? ["jpg", "jpeg", "png", "webp"]
    : ["jpg", "jpeg", "png", "webp", "heic", "heif"];
  if (!file || file.size === 0) return "The photo is empty.";
  if (file.size > MAX_PHOTO_SIZE) return "Each photo must be 8 MB or smaller.";
  if (!types.includes(file.type) || !allowedExtensions.includes(extension)) return "Use JPG, PNG, WebP, HEIC, or HEIF images only.";
  return null;
}

export function hasValidImageSignature(input, type) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (["image/heic", "image/heif"].includes(type)) {
    if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") return false;
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    return ["heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1"].includes(brand);
  }
  return false;
}

export function validateLeadUpdate(input) {
  const status = cleanText(input.status, 40);
  const internalNotes = cleanText(input.internalNotes, 5000);
  if (!LEAD_STATUSES.some((item) => item.value === status)) return { valid: false, error: "Choose a valid status." };
  return { valid: true, data: { status, internal_notes: internalNotes } };
}

export function validateGalleryMetadata(input) {
  const category = cleanText(input.category, 60);
  const data = {
    alt_text: cleanText(input.altText, 180),
    caption: cleanText(input.caption, 300),
    category: GALLERY_CATEGORIES.includes(category) ? category : "Other",
    service_slug: cleanText(input.serviceSlug, 80) || null,
    featured: Boolean(input.featured),
    published: Boolean(input.published),
    team_photo: Boolean(input.teamPhoto),
    sort_order: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
    before_after_group: cleanText(input.beforeAfterGroup, 80) || null,
    before_after_role: ["before", "after"].includes(input.beforeAfterRole) ? input.beforeAfterRole : null,
  };
  if (!data.alt_text) return { valid: false, error: "Describe the photo for visitors who cannot see it." };
  return { valid: true, data };
}

export function validateTestimonial(input) {
  const source = cleanText(input.source, 40);
  const sourceUrl = cleanText(input.sourceUrl, 500);
  const rating = input.rating ? Number(input.rating) : null;
  const data = {
    customer_name: cleanText(input.customerName, 100),
    testimonial_text: cleanText(input.testimonialText, 2000),
    source: TESTIMONIAL_SOURCES.includes(source) ? source : "Other",
    source_url: sourceUrl || null,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    featured: Boolean(input.featured),
    published: Boolean(input.published),
    sort_order: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
  };
  if (!data.customer_name) return { valid: false, error: "Enter the displayed customer name." };
  if (data.testimonial_text.length < 10) return { valid: false, error: "Enter the testimonial text." };
  if (sourceUrl && !URL_PATTERN.test(sourceUrl)) return { valid: false, error: "Source links must begin with http:// or https://." };
  return { valid: true, data };
}

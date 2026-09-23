import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/adminAuthorization";
import { LEAD_STATUSES } from "@/data/adminOptions";
import { readCompanyContent } from "@/lib/companyContent";

export async function getCompanyContent() {
  return (await readCompanyContent(createServiceClient({ timeoutMs: 5000 }))).content;
}

export { LEAD_STATUSES, GALLERY_CATEGORIES, TESTIMONIAL_SOURCES } from "@/data/adminOptions";

export async function getPublicGallery({ featured = false, teamPhoto = false, limit = 24, serviceSlug = "" } = {}) {
  const client = createServiceClient();
  if (!client) return [];
  let query = client
    .from("gallery_items")
    .select("id, public_url, alt_text, caption, category, service_slug, featured, team_photo, sort_order, before_after_group, before_after_role")
    .eq("published", true)
    .is("archived_at", null)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (featured) query = query.eq("featured", true);
  if (teamPhoto) query = query.eq("team_photo", true);
  if (serviceSlug) query = query.eq("service_slug", serviceSlug);
  const { data, error } = await query;
  return error ? [] : data;
}

export async function getPublicTestimonials({ featured = false, limit = 6 } = {}) {
  const client = createServiceClient();
  if (!client) return [];
  let query = client
    .from("testimonials")
    .select("id, customer_name, testimonial_text, source, source_url, rating, featured, sort_order")
    .eq("published", true)
    .is("archived_at", null)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (featured) query = query.eq("featured", true);
  const { data, error } = await query;
  return error ? [] : data;
}

export async function getBusinessSettings() {
  const client = createServiceClient();
  if (!client) return {};
  const { data } = await client
    .from("business_settings")
    .select("business_hours, after_hours_note, emergency_service_available, announcement, announcement_enabled")
    .eq("id", "primary")
    .maybeSingle();
  return data || {};
}

export async function getDashboardData() {
  await requireAdmin();
  const client = createServiceClient();
  if (!client) return null;
  const [leadsResult, galleryResult, testimonialResult] = await Promise.all([
    client.from("leads").select("id, reference, created_at, first_name, last_name, services, status").order("created_at", { ascending: false }).limit(8),
    client.from("gallery_items").select("id, caption, created_at, published").is("archived_at", null).order("created_at", { ascending: false }).limit(5),
    client.from("testimonials").select("id, customer_name, created_at, published").is("archived_at", null).order("created_at", { ascending: false }).limit(5),
  ]);
  const leads = leadsResult.data || [];
  const counts = {};
  for (const status of LEAD_STATUSES) {
    const { count } = await client.from("leads").select("id", { count: "exact", head: true }).eq("status", status.value);
    counts[status.value] = count || 0;
  }
  return {
    recentLeads: leads,
    recentGallery: galleryResult.data || [],
    recentTestimonials: testimonialResult.data || [],
    counts,
  };
}

export async function getAdminLeads({ search = "", status = "", service = "" } = {}) {
  await requireAdmin();
  const client = createServiceClient();
  if (!client) return [];
  let query = client.from("leads").select("id, reference, created_at, first_name, last_name, phone, email, property_address, city, services, urgency, status").order("created_at", { ascending: false }).limit(200);
  if (status) query = query.eq("status", status);
  if (service) query = query.contains("services", [service]);
  if (search) {
    const clean = search.replace(/[,%()]/g, " ").trim();
    if (clean) query = query.or(`first_name.ilike.%${clean}%,last_name.ilike.%${clean}%,phone.ilike.%${clean}%,email.ilike.%${clean}%,property_address.ilike.%${clean}%,city.ilike.%${clean}%,reference.ilike.%${clean}%`);
  }
  const { data, error } = await query;
  return error ? [] : data;
}

export async function getAdminLead(id) {
  await requireAdmin();
  const client = createServiceClient();
  if (!client) return null;
  const { data } = await client.from("leads").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const photoReferences = await Promise.all((data.photo_references || []).map(async (photo) => {
    const { data: signed } = await client.storage.from("lead-photos").createSignedUrl(photo.path, 900);
    return { ...photo, signedUrl: signed?.signedUrl || null };
  }));
  return { ...data, photo_references: photoReferences };
}

export async function getAdminGallery() {
  await requireAdmin();
  const client = createServiceClient();
  if (!client) return [];
  const { data } = await client.from("gallery_items").select("*").is("archived_at", null).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  return data || [];
}

export async function getAdminTestimonials() {
  await requireAdmin();
  const client = createServiceClient();
  if (!client) return [];
  const { data } = await client.from("testimonials").select("*").is("archived_at", null).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  return data || [];
}

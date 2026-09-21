import "server-only";
import { redirect } from "next/navigation";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";

export async function getAdminSession() {
  const sessionClient = await createSessionClient();
  const serviceClient = createServiceClient();
  if (!sessionClient || !serviceClient) {
    return { user: null, profile: null, configured: false };
  }

  const { data, error } = await sessionClient.auth.getUser();
  if (error || !data.user) {
    return { user: null, profile: null, configured: true };
  }

  const { data: profile } = await serviceClient
    .from("admin_users")
    .select("user_id, display_name")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return { user: profile ? data.user : null, profile, configured: true };
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.configured) redirect("/admin/login?setup=required");
  if (!session.user) redirect("/admin/login");
  return session;
}

export async function authorizeAdminRequest() {
  const session = await getAdminSession();
  if (!session.configured) {
    return { ok: false, status: 503, message: "Admin storage is not configured." };
  }
  if (!session.user) {
    return { ok: false, status: 401, message: "Sign in is required." };
  }
  return { ok: true, ...session };
}


import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/adminAuthorization";
import { createServiceClient } from "@/lib/supabase/server";
import { business } from "@/data/business";

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanName(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 120);
}

async function readAdmins(client) {
  const [{ data: profiles, error: profileError }, { data: users, error: usersError }] = await Promise.all([
    client.from("admin_users").select("user_id, display_name, created_at").order("created_at", { ascending: true }),
    client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (profileError || usersError) throw new Error("Admin users could not be loaded.");
  const byId = new Map((users.users || []).map((user) => [user.id, user]));
  return (profiles || []).map((profile) => ({ userId: profile.user_id, email: byId.get(profile.user_id)?.email || "", displayName: profile.display_name || "", createdAt: profile.created_at }));
}

export async function GET() {
  const auth = await authorizeAdminRequest();
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  try {
    const admins = await readAdmins(createServiceClient());
    return NextResponse.json({ admins });
  } catch {
    return NextResponse.json({ message: "Admin users could not be loaded." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await authorizeAdminRequest();
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  const input = await request.json();
  const email = cleanEmail(input.email);
  const displayName = cleanName(input.displayName);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ message: "Enter a valid email address." }, { status: 422 });
  const client = createServiceClient();
  try {
    const { data: existingProfiles } = await client.from("admin_users").select("user_id");
    const { data: userPage, error: usersError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;
    let user = (userPage.users || []).find((item) => item.email?.toLowerCase() === email);
    if (user && (existingProfiles || []).some((profile) => profile.user_id === user.id)) return NextResponse.json({ message: "That user is already an active administrator." }, { status: 409 });
    if (!user) {
      const invited = await client.auth.admin.inviteUserByEmail(email, { redirectTo: `${business.canonicalUrl}/auth/callback` });
      if (invited.error || !invited.data.user) return NextResponse.json({ message: "The invitation could not be sent. Verify the email provider is configured." }, { status: 422 });
      user = invited.data.user;
    }
    const { error } = await client.from("admin_users").insert({ user_id: user.id, display_name: displayName || email });
    if (error) return NextResponse.json({ message: "The administrator could not be activated." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "The administrator could not be added." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await authorizeAdminRequest();
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  const userId = String((await request.json()).userId || "");
  if (!userId || userId === auth.user.id) return NextResponse.json({ message: "You cannot deactivate your own account." }, { status: 422 });
  const client = createServiceClient();
  const { count, error: countError } = await client.from("admin_users").select("user_id", { count: "exact", head: true });
  if (countError) return NextResponse.json({ message: "Administrator status could not be checked." }, { status: 500 });
  if ((count || 0) <= 1) return NextResponse.json({ message: "The last active administrator cannot be deactivated." }, { status: 422 });
  const { error } = await client.from("admin_users").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ message: "The administrator could not be deactivated." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

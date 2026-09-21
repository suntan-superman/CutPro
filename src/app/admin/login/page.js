import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/adminAuthorization";
import LoginForm from "@/components/admin/LoginForm";
import { TreeMark } from "@/components/ui/Icons";

export const metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }) {
  const [session, query] = await Promise.all([getAdminSession(), searchParams]);
  if (session.user) redirect("/admin");
  return <main className="admin-login-page"><div className="admin-login-card"><Link href="/" className="admin-login-brand"><TreeMark className="size-12" /><span><strong>CUTPRO</strong><small>Owner portal</small></span></Link><h1>Welcome back.</h1><p>Sign in to manage estimate leads, project photos, testimonials, and business notices.</p><LoginForm setupRequired={query?.setup === "required" || !session.configured} /><Link href="/" className="back-to-site">← Return to public website</Link></div></main>;
}


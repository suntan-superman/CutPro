"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MenuIcon, TreeMark } from "@/components/ui/Icons";
import AdminSessionGuard from "@/components/admin/AdminSessionGuard";
import { ADMIN_ACTIVITY_STORAGE_KEY } from "@/lib/adminIdle";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/leads", label: "Estimate leads" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/testimonials", label: "Testimonials" },
  { href: "/admin/company", label: "Company / About" },
  { href: "/admin/settings", label: "Business settings" },
];

export default function AdminShell({ profile, children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const clearActivity = () => window.localStorage.removeItem(ADMIN_ACTIVITY_STORAGE_KEY);
  return <div className="admin-app"><AdminSessionGuard /><aside className={`admin-sidebar ${open ? "open" : ""}`}><Link className="admin-brand" href="/admin" onClick={() => setOpen(false)}><TreeMark className="size-9" /><span><strong>CUTPRO</strong><small>Owner portal</small></span></Link><nav>{links.map((link) => { const active = link.exact ? pathname === link.href : pathname.startsWith(link.href); return <Link key={link.href} href={link.href} className={active ? "active" : ""} onClick={() => setOpen(false)}>{link.label}</Link>; })}</nav><div className="admin-user"><span>Signed in as</span><strong>{profile?.display_name || "CutPro admin"}</strong><form action="/api/admin/auth/logout" method="post" onSubmit={clearActivity}><button type="submit">Sign out</button></form></div></aside><div className="admin-main"><header className="admin-mobile-header"><button type="button" aria-expanded={open} aria-label={open ? "Close admin menu" : "Open admin menu"} onClick={() => setOpen((value) => !value)}><MenuIcon open={open} /></button><strong>CUTPRO owner portal</strong><Link href="/" target="_blank">View site</Link></header><div className="admin-content">{children}</div></div></div>;
}

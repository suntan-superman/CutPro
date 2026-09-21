"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { business, primaryNavigation } from "@/data/business";
import { MenuIcon, PhoneIcon, TreeMark } from "@/components/ui/Icons";

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="utility-bar">
        <div className="shell utility-inner">
          <span>Serving Bakersfield and surrounding areas</span>
          <a href={business.phoneHref} data-phone-cta>
            <PhoneIcon className="size-4" /> {business.phoneDisplay}
          </a>
        </div>
      </div>
      <div className="shell nav-row">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <TreeMark className="brand-mark" />
          <span><strong>CUTPRO</strong><small>Tree Service</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {primaryNavigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link className="button button-primary desktop-estimate" href="/free-estimate">Free Estimate</Link>
        <button className="menu-button" type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((value) => !value)}>
          <MenuIcon open={open} />
        </button>
      </div>
      <nav id="mobile-menu" className={`mobile-nav ${open ? "mobile-nav-open" : ""}`} aria-label="Mobile navigation">
        <div className="shell">
          {primaryNavigation.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
          ))}
          <Link href="/free-estimate" className="button button-primary" onClick={() => setOpen(false)}>Get a Free Estimate</Link>
        </div>
      </nav>
    </header>
  );
}

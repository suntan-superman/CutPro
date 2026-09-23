import Link from "next/link";
import { business, primaryNavigation } from "@/data/business";
import { services } from "@/data/services";
import { PhoneIcon, TreeMark } from "@/components/ui/Icons";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <div className="brand brand-footer"><TreeMark className="brand-mark" /><span><strong>CUTPRO</strong><small>Tree Service</small></span></div>
          <p>{business.tagline}</p>
          <a href={business.phoneHref} className="footer-phone" data-phone-cta><PhoneIcon className="size-5" /> {business.phoneDisplay}</a>
        </div>
        <div>
          <h2>Explore</h2>
          <ul>{primaryNavigation.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}</ul>
        </div>
        <div>
          <h2>Services</h2>
          <ul>{services.map((service) => <li key={service.slug}><Link href={`/services/${service.slug}`}>{service.name}</Link></li>)}</ul>
        </div>
        <div>
          <h2>Get started</h2>
          <p>Send job details and optional photos from any device.</p>
          <Link href="/free-estimate" className="text-link">Request an estimate →</Link>
        </div>
      </div>
      <div className="shell footer-credits" aria-label="Website credits">
        <p className="footer-credit-primary">Brought to you by <strong>GNZ Marketing, LLC</strong></p>
        <p className="footer-credit-secondary">Powered by Workside Software, LLC.</p>
      </div>
      <div className="shell footer-bottom">
        <p>© {new Date().getFullYear()} {business.name}. All rights reserved.</p>
        <div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/admin/login">Admin</Link></div>
      </div>
    </footer>
  );
}

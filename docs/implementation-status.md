# Implementation status

Date: September 20, 2026

## Completed in this repository

- Phase 1: isolated Git repository, JavaScript-only Next.js scaffold, Tailwind design system, centralized business/service/area/FAQ data, environment template, and managed-platform ADR.
- Phase 2: responsive homepage, services index and four service pages, About, dynamic Gallery, Contact, Privacy, Terms, reusable navigation/footer/CTA components, mobile call bar, and honest media placeholders.
- Phase 3: five-step mobile estimate form, previews/removal for six photos, defined HEIC strategy, client and server validation, honeypot/minimum-fill-time/rate-limit protection, optional Turnstile, idempotent persistent lead creation, private storage, owner notification, customer acknowledgement, and safe failure messages.
- Phase 3B: explicitly provisioned Supabase login, server-side admin checks, dashboard, searchable/filterable lead manager, lead detail/photos/status/internal notes, gallery manager, before/after pairing, testimonial manager, limited business settings, logout, empty states, and destructive-action confirmation.
- Phase 4: unique route metadata, canonicals, Open Graph data, LocalBusiness/Service/Breadcrumb/FAQ JSON-LD, robots, sitemap, internal links, and a substantive Bakersfield service-area page.
- Phase 5: environment-gated GA4 events, security headers, upload size/type/extension/signature checks, random storage paths, image resizing/WebP normalization/metadata stripping, private lead photos, accessible forms/navigation/focus states, reduced-motion support, and server-side authorization on every admin mutation.
- Phase 6 (local): lint, unit tests, optimized production build, direct-route crawl, API failure-path tests, admin redirect test, desktop/mobile visual review, and Lighthouse review.

## Verified results

- `npm run lint`: passes
- `npm test`: 9 passing tests
- `npm run build`: passes with all planned routes generated
- Homepage Lighthouse: 100 Performance, 100 Accessibility, 100 Best Practices, 100 SEO
- Free Estimate Lighthouse: 100 Best Practices and SEO; its single contrast finding was corrected after the audit
- Public route crawl: all discovered internal links returned HTTP 200
- Unconfigured admin access redirects to setup/login; privileged API access fails closed
- Unconfigured public submission returns a useful call-now message and does not pretend the lead was accepted

## External launch dependencies

These cannot be completed or truthfully simulated without CutPro/provider access:

1. Supabase project credentials, schema execution, storage buckets, and a provisioned admin user
2. Resend sending-domain verification, API key, sender, and owner lead inbox
3. Optional Cloudflare Turnstile keys
4. Production GA4 measurement ID and Search Console ownership
5. Netlify account/site, production domain, DNS, and TLS access
6. Customer-approved business hours, service-area list, emergency policy, trust/licensing claims, authentic project media, and genuine testimonials

After those are supplied, follow `README.md` and `docs/operations.md`, then run the full live persistence/email/storage/admin smoke test before DNS cutover.


# Implementation status

Updated: September 21, 2026

## Completed in this repository

- Phase 1: isolated Git repository, JavaScript-only Next.js scaffold, Tailwind design system, centralized business/service/area/FAQ data, environment template, and managed-platform ADR.
- Phase 2: responsive homepage, services index and four service pages, About, dynamic Gallery, Contact, Privacy, Terms, reusable navigation/footer/CTA components, mobile call bar, and honest media placeholders.
- Phase 3: five-step mobile estimate form, previews/removal for six photos, defined HEIC strategy, client and server validation, honeypot/minimum-fill-time/rate-limit protection, optional Turnstile, idempotent persistent lead creation, private storage, owner notification, customer acknowledgement, and safe failure messages.
- Phase 3B: explicitly provisioned Supabase login, server-side admin checks, dashboard, searchable/filterable lead manager, lead detail/photos/status/internal notes, gallery manager, before/after pairing, testimonial manager, limited business settings, logout, empty states, and destructive-action confirmation.
- Phase 4: unique route metadata, canonicals, Open Graph data, LocalBusiness/Service/Breadcrumb/FAQ JSON-LD, robots, sitemap, internal links, and a substantive Bakersfield service-area page.
- Phase 5: environment-gated GA4 events, security headers, upload size/type/extension/signature checks, random storage paths, image resizing/WebP normalization/metadata stripping, private lead photos, accessible forms/navigation/focus states, reduced-motion support, and server-side authorization on every admin mutation.
- Phase 6 (local): lint, unit tests, optimized production build, direct-route crawl, API failure-path tests, admin redirect test, desktop/mobile visual review, and Lighthouse review.

## Original v2 baseline results (September 20)

- `npm run lint`: passes
- `npm test`: 9 passing tests
- `npm run build`: passes with all planned routes generated
- Homepage Lighthouse: 100 Performance, 100 Accessibility, 100 Best Practices, 100 SEO
- Free Estimate Lighthouse: 100 Best Practices and SEO; its single contrast finding was corrected after the audit
- Public route crawl: all discovered internal links returned HTTP 200
- Unconfigured admin access redirects to setup/login; privileged API access fails closed
- Unconfigured public submission returns a useful call-now message and does not pretend the lead was accepted

## Local Supabase/Admin certification (September 21)

- Existing baseline: branch `main`, commit `558cf07` (`Implement CutPro v2 website admin and lead management`), already pushed to the existing GitHub repository and deployed on the existing Netlify site.
- Existing Supabase project `wvkihitkavgzgxthzunt`: schema installed, modern API keys saved only in Git-ignored `.env.local`, local connectivity verified without printing keys.
- Server-side reads succeeded for all five tables. Public-key and authenticated-nonadmin reads exposed no table rows; direct public access to the populated authorization table and retained lead was denied.
- Storage verified: `lead-photos` private, `gallery-media` public, both with 8 MB object limits.
- Auth settings verified: public signup OFF, anonymous sign-in OFF, Email provider ON. The operator created the sole confirmed Auth account in the dashboard; its UUID was added to `admin_users` and read back successfully. Public-key reads of the now-populated authorization table still return no rows.
- `npm run check` passed with real Supabase configuration: lint, 29 tests, and production build. Tests cover cookie hardening, logout cleanup on remote failures, image-input error classification, and credentials absent from `.env.example`.
- The operator's actual password sign-in returned 200 and opened Admin. Incorrect password returned 401; valid nonadmin login returned 403 and cleared its cookies. The temporary nonadmin Auth account was deleted after identity verification; only the operator's account remains.
- Authorization certification passed 59 checks: anonymous and authenticated-nonadmin HTML/RSC access denied across all six protected Admin route shapes, all eight privileged API mutation handlers returned 401, and direct database reads exposed no rows.
- Gallery: single/multiple uploads and previews, caption/category/service edits, featured/published/order controls, before/after pairing, 2200px WebP conversion/metadata stripping, invalid/oversized/spoofed input rejection, mixed-batch rollback, and native confirmation cancel/accept all passed. Public updates required no rebuild. All test gallery rows are archived/unpublished and all test gallery objects are removed.
- Testimonials: create/edit/source/link/rating, featured and ordinary publication, ordering, publish/unpublish, and native archive cancel/accept passed through Admin UI. All synthetic review rows are archived/unpublished and absent from the public site.
- Public estimate: the actual mobile-width UI created exactly one Workside QA lead, **CP-20260921-5F7A0C**, with two private photos and all requested fields. Idempotent replay returned the same reference and created no extra lead or objects. Public photo URLs/anonymous downloads failed, authorized signed images worked, and the Admin search/filters/contact links/notes and all five statuses persisted. This clearly marked QA lead remains in Won; it was not deleted. Resend was unconfigured throughout.
- Session refresh was exercised by expiring stored session metadata: the proxy rotated the refresh token, persisted hardened cookies, and kept navigation authorized. Safe business settings were tested through UI and restored exactly. No credentials or tokens were logged. Logout's upstream-error cleanup paths also passed six focused unit tests without forcing a live service outage.
- Real operator logout returned 303, removed all project auth cookies, and subsequent protected access redirected to login. A local redirect-host mismatch discovered by that check was corrected by using a relative login redirect so it stays on the browser's origin behind reverse proxies.
- Final public browser crawl: 18 linked route/query variants plus robots, sitemap, and login returned 200, with zero browser errors. Final valid gallery/testimonial/lead/settings runs had no unexpected browser console errors; rejected upload requests intentionally produced 422 network errors.
- The actual server secret was absent from all checked page responses and all 22 browser-build artifacts. Credential values were not printed by these checks.
- Existing Netlify deployment certification remains pending. Local success does not certify Netlify's large-file upload path, HTTPS cookies, deployed environment, or customer launch readiness. No DNS, analytics, or production email configuration has been changed.

### Defects resolved and remaining upload constraint

- Private Admin data getters now verify authorization before service-client queries, including private signed-photo links; the protected layout is not the only read boundary.
- An `/admin` proxy propagates refreshed sessions, cookies are HttpOnly/SameSite with HTTPS-appropriate Secure flags, and logout clears local project cookies even if remote revocation fails. Local cookie/refresh behavior and injected failure cleanup are verified; real Netlify HTTPS cookie verification remains pending.
- After these fixes, anonymous HTML and RSC requests for all six protected Admin route shapes (including lead detail) returned a login redirect or RSC redirect instruction without signed-photo URLs. The local login page has `private, no-store` caching. RSC requests first normalize their query, then return a Flight redirect instruction; HTTP status alone is not the correct RSC assertion.
- Photo previews release object URLs on replacement/removal/unmount without invalidating retained estimate photos; Gallery and Testimonial labels are associated with their fields. Browser workflow checks passed.
- Gallery upload metadata inserts are atomic across a batch and uploaded objects are rolled back on failure. Deletion archives the row before removing the object and restores publication state if storage deletion fails. Tested deletion and mixed-valid/invalid batch paths left no orphan objects.
- Spoofed or undecodable image inputs now return sanitized 422 validation errors after successful rollback, rather than generic 500 errors. Genuine database/storage/operational failures remain server errors.
- Published nonfeatured testimonials now appear on the homepage instead of being silently excluded.
- `npm run qa:browser` opens a separate local Chrome profile for the operator to sign in directly, enabling actual UI-driven certification without sharing the password.
- Direct-storage upload architecture implemented locally: CutPro routes accept only bounded JSON, authenticated Gallery drafts use private `gallery-staging`, estimate drafts use private `lead-photos`, Supabase grants are exact-path and non-upsert, stored objects are independently checked, gallery output is trusted Sharp-normalized WebP, estimate originals remain private, and finalization is atomic/idempotent. The old Netlify multipart-size blocker is avoided rather than weakened. Live migration and existing-Netlify browser certification remain release gates.

## Remaining launch dependencies

These cannot be completed or truthfully simulated without CutPro/provider access:

1. Resolve the Netlify upload-size design choice and certify the existing deployed Admin and public estimate workflows
2. Resend sending-domain verification, API key, sender, and owner lead inbox when enabling email (not required for this certification phase)
3. Optional Cloudflare Turnstile keys
4. Production GA4 measurement ID and Search Console ownership
5. Existing Netlify site's URL/access and Supabase environment configuration for deployed certification; no replacement site or DNS changes
6. Customer-approved business hours, service-area list, emergency policy, trust/licensing claims, authentic project media, and genuine testimonials

Follow `README.md` and `docs/operations.md` for the locally certified workflows. Commit/push tested changes only to the existing repository and verify the existing Netlify deployment after its upload constraint/environment are addressed. Customer launch, DNS changes, analytics setup, and production email configuration remain separate steps.

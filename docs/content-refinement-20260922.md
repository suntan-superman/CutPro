# Final content refinement — September 22, 2026

Scope: focused public copy, About editing and business phone presentation. Existing Supabase/Netlify architecture, storage grants, estimate/contact persistence, email sending, gallery/testimonial controls, authentication and authorization remain in place. Baseline commit: `e136967`. The user's two untracked HEIC files were left untouched.

## Public copy

- Homepage H1: **Professional Tree Service in Bakersfield**; supporting text names tree trimming, removal, stump grinding, emergency service, homes/businesses and Bakersfield/surrounding areas. Existing estimate and phone CTAs remain. A small hero typography adjustment keeps the longer heading compact.
- Homepage SEO title remains **Tree Service in Bakersfield, CA | CUTPRO Tree Service**. Description includes all four services and the location. Existing schema is retained, with E.164 telephone values.
- About uses the supplied four-paragraph company story, company name, experience display, local heading/paragraph, estimate and phone CTAs. Existing team photo selection is preserved. Defaults state locally owned and more than 10 years; no credentials or other business claims were invented.
- Gallery and Before/After text describes projects and property care. Removed references to the portal, publication, deployment and managing the website. Empty gallery/pair states honestly say photos are coming soon.

## Storage and editor

`public.company_content` has one row (`id = 'primary'`), `content` JSONB, `updated_at` and `updated_by`. Uses the existing Supabase server adapter, authorization check and timestamp trigger. This project does not use Firestore. The additive migration has RLS, no direct browser grants/policies, and needs no extra indexes beyond its primary key. The operator confirmed installation during this implementation.

**Admin → Company / About** supplies all requested fields, field validation, loading/error states, retry, save confirmation, saved time, unsaved status and optional preview. React escapes text and API validation rejects HTML, wrong types, absent fields and excessive lengths. Request bodies are bounded at 64 KiB including chunked bodies. The authenticated user's ID sets the audit field, regardless of submitted input. The editor fails closed on a failed initial read; a public failed read uses static approved defaults.

## Phone

`NEXT_PUBLIC_BUSINESS_PHONE` supplies display, telephone links and schema. `NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY` is a legacy fallback when the primary variable is empty. US numbers normalize to `(XXX) XXX-XXXX` and `tel:+1XXXXXXXXXX`; malformed numbers retain raw display and are omitted from machine-readable E.164 fields. The existing unconfigured default is preserved. The customer phone-input mask is unchanged.

Production inspection before deployment found visible `(213) 466-1363` text paired with `tel:+16613437663` links. The operator was asked to set `NEXT_PUBLIC_BUSINESS_PHONE=+12134661363` in Netlify Build/Functions scopes. No Merxus configuration or DNS was changed.

## QA

- `npm run check` passed: lint, 95 automated tests and production build.
- New tests cover validation, unavailable/corrupt-content defaults, anonymous/nonadmin API denial, actual request-size enforcement, audit-field ownership, storage failures, repeatable SQL, persistence, database timestamps and browser-role RLS.
- Local production-build browser checks at 1440, 768 and 390 pixels: homepage H1/title, display/tel/JSON-LD agreement, About content, editor inputs and no horizontal scrolling. Screenshots are in ignored `artifacts/company-content-*` folders.
- Real Supabase-backed test: temporary QA admin login, default editor population, field validation, preview, simulated failed-save recovery, actual save, editor reload, public About refresh, audit timestamp/actor, approved-copy restoration, and signed-in nonadmin denial after removal of membership.
- Existing Gallery/Testimonial admin pages, public Gallery/services/contact/estimate pages, Contact phone mask/photo link, and Estimate service/job/photo steps remain usable. Existing upload/lead persistence/security tests pass. No new customer messages, estimate leads or emails were sent; email delivery was previously confirmed by the operator and sending logic was not changed.
- QA identity removed after testing. Real admin identities, leads, photos and testimonials were preserved.

## Files

- Public content: `src/app/page.js`, `src/app/about/page.js`, `src/app/gallery/page.js`, `src/components/home/HomeGallery.js`, `src/app/globals.css`.
- Company content: `src/data/companyContent.js`, `src/lib/companyContent.js`, `src/lib/companyContentRoutes.js`, `src/lib/data.js`, `src/app/api/admin/company/route.js`, `src/app/admin/(protected)/company/page.js`, `src/components/admin/CompanyContentEditor.js`, `src/components/admin/AdminShell.js`, `supabase/migrations/20260922_company_content.sql`.
- Phone/SEO: `src/lib/phone.js`, `src/data/business.js`, `src/lib/seo.js`, `src/app/services/[slug]/page.js`, `.env.example`.
- Validation/operations: `tests/company-content.test.js`, `tests/phone.test.js`, `scripts/certify-company-content.mjs`, `package.json`, `README.md`, `docs/operations.md`, this report.

## Deployment

Use only the existing GitHub main branch and Netlify site after local checks. The server route ships with Next.js; no separate backend deployment. Supabase migration is installed. No Firestore rules or indexes, new dependencies, external services, DNS changes or replacement environment-variable names are needed. Company content edits are live without rebuilds; phone environment changes require a Netlify rebuild.

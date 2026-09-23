# CutPro Tree Service

Mobile-first lead-generation site and owner-facing estimate manager for CUTPRO Tree Service. Built with Next.js App Router, React, JavaScript, Tailwind CSS, Supabase, and Resend.

## Requirements

- Node.js 20.9 or newer (validated with 20.19.4)
- npm 10 or newer
- A Supabase project for production persistence/auth/storage
- A Resend account only when enabling email delivery; it is not required for Admin/Supabase certification

## Local development

For a fresh checkout without `.env.local`:

```bash
npm install
copy .env.example .env.local
npm run dev
```

Keep an existing `.env.local`; do not overwrite saved credentials with the template. The public pages run without credentials. Estimate/contact submission and admin features intentionally report that setup is incomplete until Supabase is configured.

## Environment variables

Copy `.env.example` to `.env.local` only if the local file does not already exist, and populate it locally. Never commit `.env.local`. `.env.example` is deliberately tracked and must contain no actual credentials. `git check-ignore -v -- .env.local` confirms the local file is ignored. Never print credential files or include them in screenshots/logs; the app does not require the database password.

- `NEXT_PUBLIC_SITE_URL`: canonical public origin
- `NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY`: the sole source for the public business phone display, call links, customer email phone CTA, and structured data. US input is shown as `(XXX) XXX-XXXX` and dialed as `tel:+1XXXXXXXXXX`. Change only this variable and rebuild/redeploy when the answering number changes. Unrecognized formats retain their configured text. There is no hard-coded phone fallback; `NEXT_PUBLIC_BUSINESS_PHONE` is not used.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase project URL and browser-safe publishable key
- `SUPABASE_SECRET_KEY`: server-only database/storage secret key (never expose it in client code)
- `RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL`, `EMAIL_FROM`: transactional email configuration
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: optional GA4 measurement ID
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: optional Cloudflare Turnstile protection; configure both together

The owner portal's **Business settings** page includes administrator access management. Adding an administrator sends an invitation through Supabase Auth and activates that identity for the portal; deactivation removes portal access while retaining the Auth identity for possible later reactivation.

## Supabase setup

Company/About editing uses the existing Supabase project. Run `supabase/migrations/20260922_company_content.sql` after the base schema; it adds one protected singleton table without replacing content. The public About page uses the confirmed default copy if that table is empty or unavailable. In Admin, open **Company / About**, edit the plain-text fields, and save. Changes appear on the About page without a deployment; the optional preview is local until saved. See `docs/content-refinement-20260922.md` for implementation and QA details.

1. Use the existing CutPro project, `wvkihitkavgzgxthzunt`; do not create a replacement project.
2. For initial installation, run the entire `supabase/schema.sql` in SQL Editor. This creates the five tables, constraints, indexes, timestamp triggers, RLS configuration, and both storage buckets. It has already been installed in the existing project; do not manually duplicate those resources.
3. Under Authentication > Sign In / Providers, disable public sign-ups and anonymous sign-ins, and keep the Email provider enabled.
4. Under Settings > API Keys, copy the publishable and secret keys directly into the corresponding `.env.local` entries above. The existing project reference is `wvkihitkavgzgxthzunt`; copy its URL from the dashboard into `.env.local` rather than recording the environment value in source. Restart the local server after environment changes. No passwords or API keys belong in chat or tracked files.
5. Create only the authorized initial administrator under Authentication > Users > Add user > Create new user. Use their own email and a unique password stored in their password manager. Enable Auto Confirm User for this explicitly provisioned account; do not disable email confirmation project-wide. Add that Auth user's UUID to `public.admin_users`:

```sql
insert into public.admin_users (user_id, display_name)
values ('AUTH-USER-UUID', 'CutPro Administrator');
```

6. Run the additive `supabase/migrations/20260921_direct_uploads.sql` in SQL Editor for direct uploads. Keep `lead-photos` private and `gallery-media` public; the migration adds private `gallery-staging`. All three buckets enforce 8 MiB per object. Upload ledgers and budget counters have RLS with no browser policies; only server-role code can issue narrowly scoped upload grants. Do not add anonymous Storage write policies.
7. Complete local login, authorization, gallery, testimonial, and estimate tests before updating the existing Netlify environment/deployment. Configure Auth Site URL and allowed redirect URLs for the existing deployed origin when certifying it; do not change DNS.

Admin users sign in at `/admin/login`. There is no public registration route.

The app also accepts legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names for an existing project, but current Supabase projects should use the publishable and secret keys above.

## Photo handling

Estimate requests accept up to six JPG, PNG, WebP, HEIC, or HEIF files, with an 8 MiB limit per file (48 MiB maximum batch). Browser image bytes go directly to private Supabase Storage. CutPro receives only bounded JSON metadata and issues exact-path signed upload grants after creating an ownership-protected draft. Each stored file is size/signature checked; JPG/PNG/WebP must also decode successfully. HEIC/HEIF receive container checks and remain private without promising unsupported codec conversion. Private originals, including their metadata, are retained; do not assume estimate-photo EXIF is stripped.

Gallery uploads accept up to six JPG, PNG, or WebP files, each up to 8 MiB. Every authorization, verification, and finalization request checks the admin session and allowlist. Originals upload to private quarantine, never directly to the public bucket. A small per-file verification request makes the server fetch one bounded stored object and use Sharp to produce metadata-stripped WebP with a maximum 2,200-pixel edge before public storage. No incoming Netlify request contains an image. This retains a trusted processing boundary without another image service. Gallery rows and estimate leads are finalized atomically only after all files pass.

Signed upload grants expire after Supabase's fixed two hours; application drafts accept finalization for 30 minutes. Hourly cleanup waits at least 130 minutes before removing abandoned objects or completed sessions' temporary originals. See [direct-upload architecture](docs/architecture/0002-direct-storage-uploads.md) and the operations guide for lifecycle, recovery, and rollout requirements.

## Email setup

When email setup is separately authorized, verify a sending domain with Resend, set `EMAIL_FROM` to an address on that domain, and set `LEAD_NOTIFICATION_EMAIL` to the CutPro owner inbox. Without email credentials, a valid database submission is still retained and notification delivery is skipped.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

`npm run check` runs all three checks. Live UI certification helpers are opt-in and are not part of ordinary unit tests. Start the local server, run `npm run qa:browser`, and sign in directly in that window. The scripts in `scripts/certify-*.mjs` use unmistakably synthetic content, verify real Supabase persistence, and must never be pointed at another customer's project. See the operations guide for cleanup and the retained QA lead.

The old multipart upload routes are replaced with JSON-only endpoints capped at 64 KiB. Direct storage avoids Netlify's buffered request-body limit without increasing platform limits or reducing the six-photo allowance. Unit/SQL checks are not a substitute for live Supabase and existing-Netlify browser certification; complete those before declaring the deployed workflow certified.

## Deployment

CutPro is already committed and pushed to `https://github.com/suntan-superman/CutPro` and deployed on an existing Netlify site. Do not create another repository or Netlify site. `netlify.toml` uses `npm run build`, publishes `.next`, and pins Node `20.19.4`.

For Admin/Supabase certification, first pass local lint/tests/build and live persistence tests. Then commit and push to the existing repository, configure the required environment values on the existing Netlify site, and verify that deployment. Do not alter production/custom-domain DNS, GA4/Search Console, or production email during this phase. Full customer launch still depends on approved business facts and authentic media.

## Content still required before launch

The implementation deliberately avoids unsupported claims. Confirm business email/address/hours, service area beyond Bakersfield, emergency policy, free-estimate policy, licensing/insurance claims, social/profile URLs, authentic job photos, and approved testimonials before production launch. Replace the visual media placeholders through the admin gallery after provisioning.

See [the architecture decision](docs/architecture/0001-managed-platform.md), [operations guide](docs/operations.md), and [implementation status](docs/implementation-status.md) for provisioning, release, and support details.

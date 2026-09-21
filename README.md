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
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase project URL and browser-safe publishable key
- `SUPABASE_SECRET_KEY`: server-only database/storage secret key (never expose it in client code)
- `RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL`, `EMAIL_FROM`: transactional email configuration
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: optional GA4 measurement ID
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: optional Cloudflare Turnstile protection; configure both together

## Supabase setup

1. Use the existing CutPro project, `wvkihitkavgzgxthzunt`; do not create a replacement project.
2. For initial installation, run the entire `supabase/schema.sql` in SQL Editor. This creates the five tables, constraints, indexes, timestamp triggers, RLS configuration, and both storage buckets. It has already been installed in the existing project; do not manually duplicate those resources.
3. Under Authentication > Sign In / Providers, disable public sign-ups and anonymous sign-ins, and keep the Email provider enabled.
4. Under Settings > API Keys, copy the publishable and secret keys directly into the corresponding `.env.local` entries above. The project URL is `https://wvkihitkavgzgxthzunt.supabase.co`. Restart the local server after environment changes. No passwords or API keys belong in chat or tracked files.
5. Create only the authorized initial administrator under Authentication > Users > Add user > Create new user. Use their own email and a unique password stored in their password manager. Enable Auto Confirm User for this explicitly provisioned account; do not disable email confirmation project-wide. Add that Auth user's UUID to `public.admin_users`:

```sql
insert into public.admin_users (user_id, display_name)
values ('AUTH-USER-UUID', 'CutPro Administrator');
```

6. Confirm `lead-photos` is private and `gallery-media` is public, each with an 8 MB object limit. All table RLS is enabled with no browser-access policies: the server uses the secret key and checks authorization before admin operations. Browser storage-write policies are not needed for the existing server-upload design.
7. Complete local login, authorization, gallery, testimonial, and estimate tests before updating the existing Netlify environment/deployment. Configure Auth Site URL and allowed redirect URLs for the existing deployed origin when certifying it; do not change DNS.

Admin users sign in at `/admin/login`. There is no public registration route.

The app also accepts legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names for an existing project, but current Supabase projects should use the publishable and secret keys above.

## Photo handling

Estimate requests accept up to six JPG, PNG, WebP, HEIC, or HEIF files, with an 8 MB limit per file and a 32 MB combined limit. The server validates the declared MIME type, extension, and file signature. JPG/PNG/WebP uploads are autorotated, resized to a maximum 2,000-pixel edge, converted to WebP, and stripped of normal image metadata before private storage. HEIC/HEIF files are signature-checked and preserved privately because codec support varies by deployment; the form shows a file card instead of promising an unreliable browser preview.

Gallery uploads accept JPG, PNG, and WebP, then normalize them to metadata-stripped WebP with a maximum 2,200-pixel edge before public storage. Database rows contain only metadata and object references, never image binaries.

## Email setup

When email setup is separately authorized, verify a sending domain with Resend, set `EMAIL_FROM` to an address on that domain, and set `LEAD_NOTIFICATION_EMAIL` to the CutPro owner inbox. Without email credentials, a valid database submission is still retained and notification delivery is skipped.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

`npm run check` runs all three checks. Live UI certification helpers are opt-in and are not part of ordinary unit tests. Start the local server, run `npm run qa:browser`, and sign in directly in that window. The scripts in `scripts/certify-*.mjs` use unmistakably synthetic content, verify real Supabase persistence, and must never be pointed at another customer's project. See the operations guide for cleanup and the retained QA lead.

The configured per-photo limits are currently **local application limits**, not certified Netlify upload limits. Original multipart photo batches can exceed Netlify's request-size cap before server image processing starts. Resolve this before deployed large-photo certification; do not assume a successful localhost upload proves the existing Netlify deployment accepts the same batch.

## Deployment

CutPro is already committed and pushed to `https://github.com/suntan-superman/CutPro` and deployed on an existing Netlify site. Do not create another repository or Netlify site. `netlify.toml` uses `npm run build`, publishes `.next`, and pins Node `20.19.4`.

For Admin/Supabase certification, first pass local lint/tests/build and live persistence tests. Then commit and push to the existing repository, configure the required environment values on the existing Netlify site, and verify that deployment. Do not alter production/custom-domain DNS, GA4/Search Console, or production email during this phase. Full customer launch still depends on approved business facts and authentic media.

## Content still required before launch

The implementation deliberately avoids unsupported claims. Confirm business email/address/hours, service area beyond Bakersfield, emergency policy, free-estimate policy, licensing/insurance claims, social/profile URLs, authentic job photos, and approved testimonials before production launch. Replace the visual media placeholders through the admin gallery after provisioning.

See [the architecture decision](docs/architecture/0001-managed-platform.md), [operations guide](docs/operations.md), and [implementation status](docs/implementation-status.md) for provisioning, release, and support details.

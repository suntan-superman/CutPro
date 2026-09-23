# CutPro operations guide

## Lead flow

A successful estimate submission is validated on the server, inserted exactly once using its submission token, and assigned a `CP-...` reference. Valid photos are stored privately and attached to the lead as metadata. Notification email is attempted only after persistence; a mail-provider problem does not discard the lead.

## Transactional email and Resend

Resend handles outbound transactional email only. The verified sending domain is `cutprotree.com` and the sender must be the approved CutPro Tree Service identity on that domain. That sending identity is send-only today: no `@cutprotree.com` mailbox hosting exists. Do not configure Resend Receiving, change MX records, or use the sending identity as a Reply-To address.

The server reads these environment variables:

- `RESEND_API_KEY` — server-only Resend sending key. Use the narrowest sending permission available, rotate it in Resend, and update local `.env.local` plus the existing Netlify site's environment variables without printing the value.
- `LEAD_NOTIFICATION_EMAIL` — temporary real owner mailbox for new-lead notifications; it is never hard-coded.
- `EMAIL_FROM` — the approved CutPro Tree Service display name and verified sending mailbox on `cutprotree.com`.
- `EMAIL_REPLY_TO` — optional real receiving mailbox. Leave blank while CutPro has no mailbox hosting; later set it to a hosted address such as `estimates@cutprotree.com`.

The owner message includes the reference, timestamp, customer/contact facts, property, services, urgency, description, timing, notes, private-photo count, and a protected Admin Lead Manager link. It does not attach photos or include Storage URLs. The customer acknowledgement confirms receipt, includes the reference, requested service, configured CutPro phone, and `cutprotree.com`; it does not promise an appointment, response time, pricing, availability, or same-day service.

The exact sequence is validation → private-photo ownership/finalization → one atomic Supabase lead persistence → owner email attempt → customer email attempt. The two email attempts are isolated: an owner failure does not prevent the customer attempt, and either failure leaves the persisted lead and private photos intact. A replayed submission returns the existing persisted result and does not send duplicate notifications.

For a local or deployed certification, use synthetic data clearly marked `CUTPRO RESEND CERTIFICATION TEST — NOT A CUSTOMER LEAD`. Confirm both messages show the approved CutPro display name and verified-domain sender, authentication passes in Resend/delivered headers, no photo is attached, no Storage URL is exposed, and the lead remains visible through the protected Admin Lead Manager. Run `npm run check` before and after the test. Do not send routine tests to real customers.

With a local production server running, `npm run qa:resend` submits one synthetic mobile estimate, uploads one private test photo directly to Supabase, verifies exactly one persisted lead and private access, and checks the route's sanitized owner/customer send statuses. It uses `RESEND_QA_CUSTOMER_EMAIL` when set, otherwise the configured owner destination, and retains the clearly marked QA lead. The send-only key intentionally cannot list or read messages; inspect the recipient mailbox and Resend's dashboard event/authentication details to complete human delivery certification.

## Admin provisioning

Only create users for explicitly authorized CutPro staff. Keep Authentication > Sign In / Providers > Allow new users to sign up and Allow anonymous sign-ins OFF, with the Email provider ON.

For the initial administrator, use Authentication > Users > Add user > Create new user. Enter their own email and a unique password saved in their password manager, enable Auto Confirm User for this account, and create the user. This creates the login identity, not portal authorization. Add that user's UUID to `public.admin_users` with an appropriate display name, then sign in through `/admin/login`. Never share the password, API keys, session cookies, or tokens in chat, documentation, screenshots, or logs.

Provision Gabe later only after explicit approval using the same two-part process, with his own identity and credentials; do not share the initial administrator's account. Removing an individual's `admin_users` row removes application-level access on subsequent protected requests even if the login account still exists. Previously issued private-photo signed URLs remain valid until their 15-minute expiry.

Authorized administrators can now use **Business settings → Administrator access** to invite another administrator by email or deactivate an existing portal account. Deactivation removes the `admin_users` authorization row; it does not delete the Supabase Auth identity. The interface prevents an administrator from deactivating themselves or the last active administrator.

The local app uses `.env.local`, which is Git-ignored. The tracked `.env.example` is a blank template, not a credential store. Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the server-only `SUPABASE_SECRET_KEY` from Supabase Settings > API Keys. A database password is not required. After configuration changes, restart the server. Resend is optional for Admin and lead-persistence certification.

The public business phone number is configured only with `NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY`. Both human-readable `(XXX) XXX-XXXX` text and `tel:+1XXXXXXXXXX` links are generated from that same value. Set it in Netlify's production Build and Functions scopes, then redeploy when the answering service changes. `NEXT_PUBLIC_BUSINESS_PHONE` is ignored, and there is no hard-coded number fallback. JSON-LD uses E.164. The formatter does not modify Merxus routing configuration. Customer-entered lead phone numbers remain independent.

## Company / About content

Open **Company / About** in the admin navigation. Edit Company name, Years / experience display, About heading, four paragraphs, and the local section heading/paragraph. All fields are plain text with length limits. Save shows confirmation and the latest saved time. The optional preview shows current edits. These fields control the About page; the global CUTPRO logo/name remains unchanged. The existing Gallery team's photo selection still controls the About photo.

The migration `supabase/migrations/20260922_company_content.sql` creates `public.company_content`, one row with `id = 'primary'`, JSON content, server timestamp `updated_at`, and `updated_by` from the authenticated administrator. It is rerunnable and does not seed/overwrite existing content. RLS and revoked browser grants prevent direct reads/writes; the authorized server route is `/api/admin/company`. Public About reads project only content/timestamp and render escaped text. No HTML or scripts can be authored through the editor.

An empty table supplies the approved initial copy from `src/data/companyContent.js`; the first save persists it. A missing table, network failure, or invalid content also falls back publicly, but the editor reports the load failure and blocks saving until it can read reliably. Failed saves preserve edits for retry. The editor shows unsaved status; navigating away without saving discards edits, matching the existing admin pattern. Content changes need no Netlify deployment.

## Current certification checkpoint

On September 21, 2026, the local environment connected successfully to the existing Supabase project. Server reads of all five tables succeeded; the initialized settings row was not visible through the public key. Both storage bucket visibility settings and file-size limits were verified, and the Auth settings API confirmed public registration and anonymous sign-in are disabled with email sign-in enabled.

The operator signed in successfully; anonymous and real nonadmin access was denied across Admin HTML/RSC pages, APIs, and direct database reads. Gallery and Testimonial UI workflows, native delete/archive confirmations, public publish-state updates, a real public estimate with private photos, lead management, session refresh, and safe business settings passed. Settings were restored, synthetic public content was removed, and the QA lead was retained. Lint, 29 unit tests, production build, and the public browser crawl passed. See `implementation-status.md` for evidence and remaining deployed-upload constraints. This is local certification, not Netlify/customer-launch certification.

## Isolated local certification browser

With the local app listening on `127.0.0.1:3000`, run `npm run qa:browser` to open a separate Chrome profile at the Admin login page. The operator enters their own password directly into CutPro; do not provide it to scripts or chat. Leave this window open for the UI-driven certification run. The helper uses a loopback-only browser debugging port (`9235`) and stores its profile under the Git-ignored `artifacts/` directory; treat that profile as sensitive session data. It does not record login fields, traces, HARs, or storage-state exports. Close the browser when certification ends, and never force-add its profile to Git.

## Storage and retention

- `lead-photos` is private. Estimate files are uploaded through exact-path, submission-bound Supabase grants and the admin lead view generates short-lived signed download links.
- `gallery-media` is public because its content is intended for the website. Unpublished rows are not rendered publicly, but a known object URL remains readable while the object exists. Draft status is not a privacy boundary: never put private customer material into this bucket.
- Standard photo formats are resized and converted to WebP on the server. HEIC/HEIF estimate photos remain in their original private format when a reliable web conversion cannot be guaranteed.
- Leads are closed with `won` or `lost`; the UI does not expose permanent deletion.
- Testimonial removal archives the record. Gallery deletion requires confirmation and removes its stored object.

Choose a written customer-data retention window before production. Delete expired lead photos and PII under that policy using an audited maintenance task.

## Gallery workflow and first real photo batch

1. Obtain CutPro's permission to publish the photographs; remove private details and confirm ownership. Use JPG, PNG, or WebP for Gallery (HEIC/HEIF are accepted only for private estimate attachments).
2. Sign in at `/admin/login`, open Gallery, and select up to six photos. Check every preview, enter a useful photo description/caption, and choose category/service. Leave Publish now off while reviewing. Do not copy files into `/public` or edit source code.
3. Upload through the form. The browser sends image bytes directly to the private Supabase staging bucket; CutPro receives only small JSON authorization/verification requests. Review each library card; multi-upload descriptions include file-name suffixes and can be edited individually. Save descriptive text, Featured/Published state, and Display order. Featured items sort ahead of other published items; lower Display order values sort first within that priority.
4. For a Before/After pair, give both cards the same Pair name and set one Before and the other After. Publish both; feature them if they should be prioritized on the homepage. A complete pair appears in the homepage presentation.
5. Refresh the public Gallery/homepage to verify the result without a source edit or rebuild. Unpublishing removes site presentation but does not make a public object URL private. Delete requires confirmation and archives/unpublishes the row while removing its storage object.
6. Before the first real batch on Netlify, verify the direct-storage flow with realistically large phone photos. The app routes exchange only bounded JSON; image bytes go browser-to-Supabase, so the old Netlify multipart limit is not used. Do not skip the deployed timing, authorization, private-access, or cleanup checks.

## Testimonial workflow

In Testimonials, enter the real permissioned customer/display name and exact approved feedback. Set the truthful source, source URL, and rating only when the original supplies one. Save as a draft or publish, then verify the homepage. Published nonfeatured testimonials also appear; Featured controls priority, and Display order controls order within that priority. Edit and save to update live content. Unpublish hides it; Archive requires confirmation and retains an archived, unpublished record. Never publish QA feedback as genuine customer reviews.

## Lead-manager workflow

Open Estimate leads; search by reference, name, phone, email, or address, and use status/service filters. Open a lead for original customer fields, services, urgency, private photo previews, and call/email links. Add Private notes, select New, Contacted, Estimate scheduled, Won, or Lost, and click Save follow-up. Reload to confirm the change. Signed photo links expire after 15 minutes; reopen/reload the detail page for fresh links.

The retained certification record is **Workside QA**, reference **CP-20260921-5F7A0C**, explicitly marked **CUTPRO ADMIN CERTIFICATION TEST — NOT A CUSTOMER LEAD**. It has two private photos and ends in Won after all statuses were tested. Do not contact it or delete it as part of routine QA cleanup. Gallery test objects were deleted and their rows archived; testimonial test rows are archived/unpublished. No genuine customer/source content was removed.

## Repeating the live checks

### Direct-storage cleanup

Run `npm run uploads:cleanup` first (dry-run). Use `npm run uploads:cleanup -- --execute` only from the existing deployment/operator environment after reviewing counts. The scheduled `cleanup-uploads` Netlify function runs hourly and removes only ledger-owned temporary paths after the signed-grant retention window. It never enumerates a bucket or deletes a lead/gallery destination protected by a completed result. A cleanup failure leaves the ledger retryable; investigate a repeated backlog before adding customer data.

Run these only deliberately, with the correct CutPro `.env.local` and a signed-in `npm run qa:browser` session:

```powershell
node scripts/certify-authorization.mjs
node scripts/certify-gallery.mjs
node scripts/certify-testimonials.mjs
node scripts/certify-leads.mjs
node scripts/certify-session.mjs
```

Gallery/Testimonial helpers clean their own synthetic records through Admin UI. They use separate browser processes for native confirmation dialogs because simultaneous controllers of one browser can dismiss one another's dialogs. The authorization helper creates and deletes only its own marked nonadmin Auth user. The lead helper creates a retained QA lead; use `--resume-id=<existing-QA-lead-UUID>` to resume its checks without another lead. The session helper forces the stored expiry to exercise refresh, copies refreshed cookies back to the operator in memory, tests safe settings, and restores original business settings. Its optional `--logout` switch signs the operator out and must run last. Never capture HARs, traces, cookies, or credential screenshots. Profiles under ignored `artifacts/` contain sensitive session data and must not be committed.

## Launch checklist

1. Approve all business facts, services, policy text, and service areas.
2. Upload authentic, publication-authorized job media.
3. Add only genuine, permissioned testimonials.
4. Submit test estimate and contact requests from phone and desktop.
5. Confirm the persistent lead, private photo links, owner email, and customer acknowledgement.
6. Test admin login, logout, filters, status, notes, media, testimonials, and settings.
7. Set and verify the GA4 ID, production URL, domain, TLS, sitemap, and Search Console ownership.
8. Run `npm run check` against the exact release commit.

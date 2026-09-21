# ADR 0001: Managed application platform

Status: Accepted and implemented. Local Supabase/Admin/media/lead workflows are certified. Existing Netlify environment and deployed upload certification are pending; the platform request-size constraint must be resolved without creating another site or backend provider.

## Decision

Use Supabase for admin authentication, PostgreSQL persistence, row-level security, and object storage. Use Resend for transactional owner/customer email. Keep both services behind small server-only adapters so they can be replaced without rewriting the public intake or admin user interface.

## Why this is the smallest appropriate solution

The roadmap requires five related data areas, private customer photos, public gallery media, explicit admin provisioning, and secure sessions. Supabase supplies these needs in one managed platform and avoids maintaining a custom database, password system, and storage service. Resend is isolated to notification delivery and is skipped safely during local development when credentials are absent.

## Security boundaries

- Public browser code may receive only the Supabase URL and publishable key (legacy anonymous key is also supported).
- The secret key (or legacy service-role key) is used only in server modules after validation and, for admin routes, authorization.
- Public sign-up is not exposed. An authenticated account must also have a row in `admin_users`.
- Estimate photos use a private bucket and time-limited signed links.
- Gallery media uses a public bucket, while public pages query only published records.
- Secrets remain in deployment environment variables and never in source control.

## Local and unconfigured behavior

Public marketing pages remain usable without vendor credentials. Forms return a clear service-configuration error rather than pretending a lead was accepted. Admin login explains that setup is incomplete. Seed content is developer-owned fallback content; no reviews or business credentials are fabricated.

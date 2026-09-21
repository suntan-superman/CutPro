# CutPro operations guide

## Lead flow

A successful estimate submission is validated on the server, inserted exactly once using its submission token, and assigned a `CP-...` reference. Valid photos are stored privately and attached to the lead as metadata. Notification email is attempted only after persistence; a mail-provider problem does not discard the lead.

## Admin provisioning

Only create users for authorized CutPro staff. Create the Authentication user in Supabase, then add its UUID to `admin_users`. Removing that row immediately removes application-level access even if the login account still exists.

## Storage and retention

- `lead-photos` is private. The admin lead view generates short-lived signed links.
- `gallery-media` is public because its content is intended for the website. Unpublished rows are not rendered publicly.
- Standard photo formats are resized and converted to WebP on the server. HEIC/HEIF estimate photos remain in their original private format when a reliable web conversion cannot be guaranteed.
- Leads are closed with `won` or `lost`; the UI does not expose permanent deletion.
- Testimonial removal archives the record. Gallery deletion requires confirmation and removes its stored object.

Choose a written customer-data retention window before production. Delete expired lead photos and PII under that policy using an audited maintenance task.

## Launch checklist

1. Approve all business facts, services, policy text, and service areas.
2. Upload authentic, publication-authorized job media.
3. Add only genuine, permissioned testimonials.
4. Submit test estimate and contact requests from phone and desktop.
5. Confirm the persistent lead, private photo links, owner email, and customer acknowledgement.
6. Test admin login, logout, filters, status, notes, media, testimonials, and settings.
7. Set and verify the GA4 ID, production URL, domain, TLS, sitemap, and Search Console ownership.
8. Run `npm run check` against the exact release commit.

# CutPro Tree Service Website --- Codex-Ready Build Specification

**Project:** CutPro Tree Service\
**Market:** Bakersfield and surrounding Kern County communities\
**Reference:** A1 Stump & Tree Service (aonestump.com), used for
structural/conversion inspiration only\
**Stack:** Next.js, React, JavaScript, Tailwind CSS\
**Recommended fixed project quote:** **\$2,500**

## 1. Objective

Build a fast, mobile-first local lead-generation website that
establishes CutPro as a professional tree-service company and drives two
primary actions: **Get a Free Estimate** and **Call 661-343-7663**.

The site should borrow the useful conversion concepts of the reference
site---strong service presentation, authentic job imagery, trust
signals, dedicated service pages, local service-area content, repeated
call CTAs, and a photo-based estimate workflow---without copying its
branding, text, images, proprietary content, or unsupported business
claims.

## 2. Quote Scope

The \$2,500 fixed price includes custom responsive design/build;
homepage; service pages; About; Gallery; Contact; service-area
structure; Free Estimate workflow; customer photo uploads; email lead
notification; basic spam protection; local SEO foundation; metadata and
structured data; Google Analytics 4/Search Console setup assistance;
deployment; domain/SSL connection; performance/accessibility
optimization; and one reasonable post-review revision round.

Not included unless separately approved: logo design, professional
photography/video, paid advertising, ongoing SEO, Google Business
Profile management, CRM subscriptions, SMS charges, online payments,
scheduling/dispatch, AI chatbot, extensive blog production, or ongoing
support/hosting fees.

Potential later upgrades: SMS alerts and confirmations, CRM integration,
lead dashboard, appointment scheduling, automated review requests,
Spanish site, Meta Pixel/CAPI, call tracking, managed gallery, and
AI-assisted intake.

## 3. Technical Standards

Use the current CutPro/Workside framework:

-   Next.js
-   JavaScript only --- **no TypeScript**
-   React functional components only
-   Tailwind CSS
-   npm
-   Netlify deployment unless the existing project specifies otherwise
-   Git/GitHub under the current workflow
-   Next.js image optimization where deployment-compatible
-   Lightweight native React/Next.js forms and validation
-   Next.js route handlers/server functionality where needed
-   Environment variables for all secrets
-   No customer PII or secrets in source control

Do not introduce WordPress, Redux, class components, a heavy UI
framework, an unnecessary CMS, or a separate backend without a
demonstrated requirement. Keep dependencies small.

## 4. Existing CutPro Information

Preliminary information to use pending confirmation:

-   Public name: **CUTPRO Tree Service**
-   Positioning: **Professional Tree Care in Bakersfield & Surrounding
    Areas**
-   Main services: Tree Trimming, Tree Removal, Stump Grinding,
    Emergency Tree Service
-   Phone: **661-343-7663**
-   Current message: Experienced professionals. Quality work. Reliable
    service.
-   Market: homeowners, property owners, and businesses throughout Kern
    County

Never invent licensing, insurance, bonding, certifications, years in
business, arborist credentials, warranties, response times, or 24/7
availability.

## 5. Information Required From Customer Before Launch

### Business identity

Obtain exact legal/business name, preferred public name, public business
address if applicable, confirmation of phone number, lead/contact email,
business hours, after-hours policy, owner/contact name, domain
ownership/access, logo files, social profiles, and preferred colors.

### Licensing/trust

Obtain contractor license number and classification if applicable;
confirmation of insurance, bonding, and workers' compensation; years in
business; certifications; memberships; and exact trust claims they
authorize us to publish.

Never display "Licensed, Bonded & Insured" without confirmation.

### Services

Have the customer explicitly confirm YES/NO for: tree trimming, pruning,
removal, stump grinding, stump removal, emergency service, storm
cleanup, fallen-tree removal, palm trimming/removal, planting, health
assessments, cabling/bracing, brush clearing, lot clearing, chipping,
hauling/debris removal, firewood, root grinding/removal, root barriers,
commercial work, HOA/property management, multi-family, and
agricultural/ranch work.

### Emergency operations

Confirm whether service is actually 24/7; emergency phone number; types
of emergencies accepted; expected response language; and policy for
trees/power lines. Do not claim 24/7 unless operationally true.

### Service area

Get the exact cities/communities and maximum travel radius. Candidate
areas to ask about---not assume---include Bakersfield, Oildale,
Rosedale, Greenacres, Shafter, Wasco, Lamont, Arvin, Tehachapi, and
Delano.

### Estimate policy

Confirm whether estimates are free; whether onsite visits are required;
whether photos can support preliminary estimates; typical response time;
preferred customer contact method; whether customers can request dates;
and whether a "best time to call" field is desired.

### Reviews

Request Google Business Profile URL, Yelp URL, Facebook URL, and
testimonials they have permission to republish. Never fabricate reviews.

### Policies/payment

Ask about accepted payment types if they want them displayed, financing
claims, privacy contact, and whether marketing SMS/email will ever be
used.

## 6. Photo/Media Request

Request original full-resolution files rather than screenshots/social
downloads. Ideally obtain **20--40 authentic photos** covering crew at
work, removal, trimming, stump grinding, equipment/trucks, before/after
pairs, large-tree jobs, clean finished sites, residential work,
commercial work if offered, emergency work if offered, palms if offered,
difficult-access jobs, owner/crew, and professional safety/equipment
practices.

Optional 5--20 second job-site videos are useful for removal, grinding,
chipping, equipment, and before/after scenes.

Customer should confirm rights/permission to publish supplied media.

## 7. Sitemap

``` text
/
├── /services
│   ├── /tree-trimming
│   ├── /tree-removal
│   ├── /stump-grinding
│   └── /emergency-tree-service
├── /service-areas
│   ├── /bakersfield
│   └── /[confirmed-location]
├── /about
├── /gallery
├── /free-estimate
├── /contact
├── /privacy
└── /terms
```

Only add service/location pages for genuine offerings/areas. Avoid
mass-produced thin SEO pages.

## 8. Homepage

Build in this order:

1.  **Header:** logo, Services, Service Areas, Gallery, About, Contact,
    phone, Free Estimate.
2.  **Hero:** "Professional Tree Care in Bakersfield & Surrounding
    Areas"; services line; concise credibility statement; Free Estimate
    and Call CTAs; authentic hero photo.
3.  **Trust strip:** only verified claims such as licensed, insured,
    locally owned, free estimates, residential/commercial, emergency.
4.  **Real Work / Real Results:** authentic job photography.
5.  **Main services:** image, concise description, benefits, Request
    This Service, Learn More.
6.  **Why CutPro:** supportable differentiators such as professional
    equipment, property care, cleanup, communication, local service.
7.  **Before & After:** authentic paired imagery.
8.  **How Estimates Work:** Tell us the job → Upload photos → CutPro
    contacts you.
9.  **Reviews:** genuine reviews only, preferably linked to source.
10. **Service Area:** confirmed communities/map treatment.
11. **Emergency CTA:** strong click-to-call treatment; no "24/7" unless
    confirmed.
12. **Final Estimate CTA.**
13. **Footer:** company details, phone/email/hours, license if verified,
    navigation, socials, Privacy/Terms.

Mobile must make calling and requesting an estimate exceptionally easy.

## 9. Free Estimate Workflow

Route: `/free-estimate`

Optimize for completion from a phone while the customer is standing in
the yard.

### Step 1 --- Service

Multi-select from confirmed services, initially Tree Trimming, Tree
Removal, Stump Grinding, Emergency Tree Service, Other.

### Step 2 --- Job

Collect short description, approximate number of trees/stumps, urgency,
and optional preferred timeframe. Suggested urgency: Flexible, Within a
week, As soon as possible, Emergency.

### Step 3 --- Photos

Support multiple mobile uploads with file/type/size limits, progress
state, thumbnail previews, and removal before submission. Support common
image formats and define a HEIC strategy.

Do not email giant raw attachments. Preferred flow: upload optimized
images to approved managed storage, save references with the lead, and
include links/references in the lead notification.

### Step 4 --- Contact/property

Collect first/last name, phone, email, property address, city, ZIP,
preferred contact method, best contact time, and optional notes. Only
require what CutPro actually needs.

### Step 5 --- Review/submit

Show a concise submission summary plus privacy/communications
acknowledgement appropriate to actual follow-up practices.

### Confirmation

Display receipt confirmation, click-to-call, and optionally a
lead/reference ID. Do not promise a response interval until CutPro
confirms one.

## 10. Lead Delivery

At minimum, every estimate creates an immediate owner email containing
timestamp, lead ID, customer name, phone/email, address, services,
urgency, description, preferred timing, photo references, and notes.

Send a simple acknowledgement email to the customer when email is
supplied.

Architect notifications so SMS owner alerts/customer confirmations can
be added later without rebuilding the intake flow.

## 11. Service Page Template

Each major service receives a dedicated page with hero, authentic image,
service explanation, common reasons customers need it, CutPro approach,
verified safety/property-care information, cleanup/disposal details if
confirmed, related services, FAQs, estimate CTA, and call CTA.

Do not invent technical arborist, insurance, safety, or guarantee
claims.

## 12. Local SEO

Target natural intent around concepts such as "tree service
Bakersfield," "tree removal Bakersfield," "tree trimming Bakersfield,"
"stump grinding Bakersfield," "emergency tree service Bakersfield," and
"tree service Kern County."

Implement unique titles/descriptions, canonical URLs, sitemap,
robots.txt, Open Graph metadata, semantic headings, descriptive alt
text, internal linking, breadcrumbs where useful, clean URLs, and strong
mobile performance.

Implement appropriate JSON-LD such as LocalBusiness/ProfessionalService
plus Service, BreadcrumbList, and FAQPage only where content qualifies.
Business name, phone, address/service area, hours, and social URLs must
match verified business data.

Create useful location pages, not duplicated city-name swaps.

## 13. Google/Analytics Setup

When credentials/account ownership are available:

-   Google Analytics 4
-   Google Search Console
-   Sitemap submission
-   Conversion events for estimate start, estimate submit, phone CTA,
    contact submit, and optionally photo upload completion
-   Google Business Profile linking where appropriate

Never hard-code measurement IDs.

## 14. Performance & Accessibility

Targets:

-   Mobile-first
-   Responsive from small phones through desktop
-   Optimize/compress images
-   Lazy-load below-fold media
-   Avoid unnecessary JavaScript
-   Avoid layout shift
-   Keyboard-accessible forms/navigation
-   Visible focus states
-   Proper labels
-   Useful alt text
-   Adequate contrast
-   Respect reduced-motion preference
-   Aim for strong Lighthouse/Core Web Vitals results

## 15. Security & Spam

All public forms require server-side validation/sanitization, rate
limiting or equivalent abuse controls, bot/spam protection, upload
MIME/extension/size checks, safe generated filenames, no executable
uploads, no secrets in client bundles, and minimal PII retention.

Do not expose storage credentials or unrestricted upload endpoints.

## 16. Suggested Project Structure

``` text
src/
├── app/
│   ├── page.js
│   ├── services/
│   │   ├── page.js
│   │   └── [slug]/page.js
│   ├── service-areas/
│   │   ├── page.js
│   │   └── [slug]/page.js
│   ├── about/page.js
│   ├── gallery/page.js
│   ├── free-estimate/page.js
│   ├── contact/page.js
│   ├── privacy/page.js
│   ├── terms/page.js
│   └── api/
├── components/
│   ├── layout/
│   ├── home/
│   ├── services/
│   ├── estimate/
│   ├── forms/
│   └── ui/
├── data/
│   ├── business.js
│   ├── services.js
│   ├── serviceAreas.js
│   └── faqs.js
├── lib/
│   ├── validation.js
│   ├── notifications.js
│   ├── uploads.js
│   ├── analytics.js
│   └── seo.js
└── styles/
```

Centralize business facts so phone, email, license, hours, service
areas, and socials are not duplicated across components.

## 17. Content/Data Model

`business.js` should contain verified public facts. `services.js` should
drive service cards/pages/estimate choices. `serviceAreas.js` should
drive genuine location content. `faqs.js` should support shared and
service-specific FAQs.

This reduces content drift and makes future edits easy.

## 18. Design Rules

Use a strong working-contractor aesthetic: large authentic imagery,
clean typography, high contrast, obvious phone number, prominent CTA,
professional spacing, and equipment/crew/job-site imagery.

Avoid generic landscaping-template aesthetics, excessive animations,
carousel dependence, stock-photo overload, huge autoplay video, or
novelty UI.

Use the reference site's conversion concepts, **not its wording or
visual identity**.

## 19. QA / Acceptance Criteria

Before production:

-   All routes work directly and through navigation.
-   No broken images/links.
-   Phone CTAs use the correct number.
-   Estimate submission works on iPhone/Android/desktop.
-   Photo upload is tested with multiple images and oversized/invalid
    files.
-   Owner receives correct lead notification.
-   Customer acknowledgement works.
-   Required-field and server validation work.
-   Spam protection is active.
-   No secrets appear in browser/source.
-   Metadata/canonicals are correct.
-   Sitemap and robots.txt are valid.
-   JSON-LD validates.
-   Analytics production IDs are correct.
-   Conversion events fire once.
-   Responsive layouts tested at common breakpoints.
-   Keyboard navigation works.
-   No material console errors.
-   Production HTTPS/domain works.
-   Lighthouse/performance is reviewed on mobile.
-   Customer has approved business facts, services, areas, claims,
    testimonials, and images.

## 20. Implementation Phases for Codex

### Phase 1 --- Scaffold

Confirm current repository and conventions; install only necessary
dependencies; create layout/navigation/footer; centralize
business/service data; establish responsive design system.

### Phase 2 --- Core pages

Build homepage, Services index, individual service template/pages,
About, Gallery, Contact, Privacy, Terms.

### Phase 3 --- Estimate system

Build multi-step estimate UI, validation, photo handling/storage, server
submission, owner notification, customer acknowledgement, success/error
handling.

### Phase 4 --- Local SEO

Build service-area index/template, initial Bakersfield page, metadata
utilities, structured data, sitemap/robots, internal links.

### Phase 5 --- Analytics & hardening

Add approved analytics/conversion tracking, spam/security controls,
accessibility review, performance optimization, error handling.

### Phase 6 --- Production QA

Run complete functional/responsive QA; validate SEO/schema; verify forms
and notifications; deploy; connect domain/SSL; smoke-test production.

## 21. Customer Handoff Checklist

Before starting, request one package containing:

1.  Logo (SVG preferred, plus PNG if available)
2.  20--40 original photos
3.  Business/public name
4.  Owner/contact name
5.  Phone confirmation
6.  Lead email
7.  Business hours
8.  License number/classification if applicable
9.  Insurance/bonding claims they authorize
10. Confirmed services
11. Confirmed service cities/radius
12. Emergency-service policy
13. Free-estimate policy
14. Google Business Profile link
15. Yelp/Facebook/social links
16. Approved reviews/testimonials
17. Domain/registrar information or access plan
18. Preferred colors/branding
19. Years in business and other verified differentiators
20. Any services/claims they specifically do **not** want advertised

Development can begin with placeholders before every item arrives, but
unsupported claims must not reach production.

## 22. Definition of Done

V1 is done when CutPro has a production-ready, responsive
Next.js/JavaScript site; customers can understand services, call from
mobile, submit a detailed estimate with photos, and receive
confirmation; CutPro receives actionable leads; verified
services/service areas have crawlable pages; SEO/structured
data/analytics are configured; forms/uploads are secured; authentic
content is installed; production passes QA; and the customer has
approved all public business claims.

## 23. Guiding Principle

The website's job is not to impress another developer. Its job is to
make a Bakersfield-area property owner with a tree problem quickly
conclude:

**"These people can handle the job, and it is easy to get an
estimate."**

Every design and engineering decision should support that outcome.

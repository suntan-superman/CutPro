import Link from "next/link";
import { business } from "@/data/business";
import { services } from "@/data/services";
import { sharedFaqs } from "@/data/faqs";
import { getBusinessSettings, getPublicGallery, getPublicTestimonials } from "@/lib/data";
import { createMetadata, faqJsonLd } from "@/lib/seo";
import { ArrowIcon, CheckIcon, PhoneIcon } from "@/components/ui/Icons";
import MediaPlaceholder from "@/components/ui/MediaPlaceholder";
import SectionHeading from "@/components/ui/SectionHeading";
import CallToAction from "@/components/ui/CallToAction";
import JsonLd from "@/components/ui/JsonLd";
import HomeGallery from "@/components/home/HomeGallery";
import Testimonials from "@/components/home/Testimonials";

export const metadata = createMetadata({
  title: "Tree Service in Bakersfield, CA",
  description: business.summary,
  path: "/",
});

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [gallery, testimonials, settings] = await Promise.all([
    getPublicGallery({ limit: 20 }),
    getPublicTestimonials({ limit: 12 }),
    getBusinessSettings(),
  ]);
  const emergencyAvailable = settings.emergency_service_available ?? business.emergencyServiceAvailable;
  const featuredGallery = gallery.filter((item) => item.featured);
  const homeGallery = (featuredGallery.length ? featuredGallery : gallery).slice(0, 3);
  const groupedPairs = gallery.reduce((groups, item) => {
    if (!item.before_after_group || !item.before_after_role) return groups;
    groups[item.before_after_group] ||= {};
    groups[item.before_after_group][item.before_after_role] = item;
    return groups;
  }, {});
  const beforeAfterPair = Object.values(groupedPairs).find((pair) => pair.before && pair.after);

  return (
    <>
      <JsonLd data={faqJsonLd(sharedFaqs)} />
      {settings.announcement_enabled && settings.announcement && (
        <aside className="announcement"><div className="shell">{settings.announcement}</div></aside>
      )}
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Bakersfield tree service</p>
            <h1>Tree work, handled with a clear plan.</h1>
            <p className="hero-lead">Trimming, removal, stump grinding, and urgent tree-service help for properties in Bakersfield and surrounding areas.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/free-estimate">Get a Free Estimate <ArrowIcon className="size-5" /></Link>
              <a className="button button-ghost" href={business.phoneHref} data-phone-cta><PhoneIcon className="size-5" /> {business.phoneDisplay}</a>
            </div>
            <p className="hero-note">Send photos from your phone to help explain the job.</p>
          </div>
          <div className="hero-visual">
            <MediaPlaceholder label="CutPro project photo pending" />
            <div className="hero-badge"><strong>4</strong><span>core tree<br />services</span></div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="CutPro service highlights">
        <div className="shell">
          {["Bakersfield focused", "Residential & commercial requests", "Photo-ready estimates", "Direct phone access"].map((item) => (
            <span key={item}><CheckIcon className="size-5" /> {item}</span>
          ))}
        </div>
      </section>

      <section className="section work-section">
        <div className="shell"><HomeGallery items={homeGallery} /></div>
      </section>

      <section className="section section-cream">
        <div className="shell">
          <SectionHeading eyebrow="What we do" title="The right starting point for the tree in front of you." copy="Choose the service that best matches the job. If you are not sure, select Other on the estimate form and describe what you see." />
          <div className="service-grid">
            {services.map((service, index) => (
              <article className={`service-card service-${service.accent}`} key={service.slug}>
                <span className="service-number">0{index + 1}</span>
                <p className="eyebrow">{service.eyebrow}</p>
                <h3>{service.name}</h3>
                <p>{service.shortDescription}</p>
                <div className="service-links">
                  <Link href={`/free-estimate?service=${service.slug}`} className="text-link">Request this service</Link>
                  <Link href={`/services/${service.slug}`} aria-label={`Learn more about ${service.name}`}><ArrowIcon className="size-6" /></Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell grid-two why-grid">
          <div>
            <SectionHeading eyebrow="Why CutPro" title="Details first. Straight answers next." />
            <p className="large-copy">A useful estimate begins with understanding the actual property, the access, and what you want the space to become.</p>
          </div>
          <div className="feature-list">
            {[
              ["Property-aware planning", "Share the tree location, nearby structures, gates, and access so the conversation starts with the real site."],
              ["Simple communication", "Call directly or send one structured request with the details and photos together."],
              ["Scope you can understand", "CutPro follows up to clarify the requested work before an estimate becomes a scheduled job."],
            ].map(([title, copy], index) => (
              <article key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="shell">
          <SectionHeading eyebrow="Before & after" title="The difference is in the finished space." copy="Approved before-and-after pairs can be published from the owner portal without a new deployment." />
          <div className="before-after-grid">
            <div><span>Before</span>{beforeAfterPair?.before ? <figure>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={beforeAfterPair.before.public_url} alt={beforeAfterPair.before.alt_text} /></figure> : <MediaPlaceholder label="Before photo pending" compact />}</div>
            <div><span>After</span>{beforeAfterPair?.after ? <figure>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={beforeAfterPair.after.public_url} alt={beforeAfterPair.after.alt_text} /></figure> : <MediaPlaceholder label="After photo pending" compact />}</div>
          </div>
        </div>
      </section>

      <section className="section process-section">
        <div className="shell">
          <SectionHeading eyebrow="A better estimate request" title="Three steps from your yard." align="center" />
          <div className="process-grid">
            {[
              ["01", "Tell us the job", "Choose the service and describe the tree, stump, or urgent concern."],
              ["02", "Add photos", "Upload up to six phone photos. You can preview and remove each one."],
              ["03", "CutPro follows up", "Your details are saved together so the next conversation starts informed."],
            ].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
        </div>
      </section>

      <Testimonials items={testimonials} />

      <section className="section area-section">
        <div className="shell grid-two">
          <div>
            <SectionHeading eyebrow="Local service" title="Built for Bakersfield properties." copy="CutPro serves Bakersfield and evaluates surrounding-area requests by job location and scope." />
            <Link href="/service-areas/bakersfield" className="button button-outline">Explore the service area</Link>
          </div>
          <div className="area-map" aria-label="Stylized map showing Bakersfield service focus">
            <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-ring"><span>Bakersfield</span></div>
          </div>
        </div>
      </section>

      {emergencyAvailable && (
        <section className="emergency-strip">
          <div className="shell">
            <div><p className="eyebrow">Urgent tree concern?</p><h2>Start with a direct call.</h2><p>{settings.after_hours_note || business.afterHoursNote}</p></div>
            <a href={business.phoneHref} className="button button-primary" data-phone-cta><PhoneIcon className="size-5" /> Call {business.phoneDisplay}</a>
          </div>
        </section>
      )}

      <section className="section faq-section">
        <div className="shell grid-two faq-layout">
          <SectionHeading eyebrow="Good to know" title="Before you send the request." />
          <div className="faq-list">
            {sharedFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { business } from "@/data/business";
import { getService, services } from "@/data/services";
import { sharedFaqs } from "@/data/faqs";
import { absoluteUrl, breadcrumbJsonLd, createMetadata, faqJsonLd } from "@/lib/seo";
import { CheckIcon, PhoneIcon } from "@/components/ui/Icons";
import JsonLd from "@/components/ui/JsonLd";
import MediaPlaceholder from "@/components/ui/MediaPlaceholder";
import CallToAction from "@/components/ui/CallToAction";
import { getPublicGallery } from "@/lib/data";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return services.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};
  return createMetadata({
    title: `${service.name} in Bakersfield, CA`,
    description: service.shortDescription,
    path: `/services/${slug}`,
  });
}

export default async function ServicePage({ params }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();
  const photos = await getPublicGallery({ serviceSlug: service.slug, limit: 6 });
  const related = services.filter((item) => item.slug !== slug).slice(0, 3);
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.shortDescription,
    url: absoluteUrl(`/services/${slug}`),
    provider: { "@type": "ProfessionalService", name: business.name, ...(business.phoneE164 ? { telephone: business.phoneE164 } : {}) },
    areaServed: "Bakersfield, California",
  };
  return (
    <>
      <JsonLd data={serviceSchema} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }, { name: service.name, path: `/services/${slug}` }])} />
      <JsonLd data={faqJsonLd(sharedFaqs)} />
      <header className="service-hero">
        <div className="shell grid-two">
          <div>
            <div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><Link href="/services">Services</Link><span>/</span>{service.name}</div>
            <p className="eyebrow">{service.eyebrow}</p><h1>{service.name} in Bakersfield</h1><p>{service.shortDescription}</p>
            <div className="hero-actions"><Link className="button button-primary" href={`/free-estimate?service=${service.slug}`}>Request this service</Link><a className="button button-outline" href={business.phoneHref} data-phone-cta><PhoneIcon className="size-5" /> Call CutPro</a></div>
          </div>
          {photos.length ? <div className="service-photo-stack">{photos.slice(0, 2).map((item) => <figure className="service-photo" key={item.id}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.public_url} alt={item.alt_text} />{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}</div> : <MediaPlaceholder label={`${service.name} project photo pending`} />}
        </div>
      </header>
      <section className="section"><div className="shell grid-two service-detail"><div><p className="eyebrow">The service</p><h2>A site-specific conversation.</h2><p className="large-copy">{service.description}</p></div><div><h3>Common reasons to call</h3><ul className="check-list">{service.reasons.map((item) => <li key={item}><CheckIcon className="size-5" />{item}</li>)}</ul></div></div></section>
      <section className="section section-cream"><div className="shell"><div className="section-heading"><p className="eyebrow">CutPro&apos;s approach</p><h2>What happens before the work.</h2></div><div className="process-grid compact-process">{service.approach.map((item, index) => <article key={item}><span>0{index + 1}</span><p>{item}</p></article>)}</div></div></section>
      <section className="section"><div className="shell"><div className="section-heading"><p className="eyebrow">Related services</p><h2>More ways to clear the next task.</h2></div><div className="related-grid">{related.map((item) => <Link href={`/services/${item.slug}`} key={item.slug}><span>{item.name}</span><small>{item.shortDescription}</small><strong>Learn more →</strong></Link>)}</div></div></section>
      <section className="section section-cream"><div className="shell grid-two faq-layout"><div className="section-heading"><p className="eyebrow">Questions</p><h2>Useful details before you request an estimate.</h2></div><div className="faq-list">{sharedFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></div></section>
      <CallToAction title={`Tell CutPro about your ${service.name.toLowerCase()} project.`} />
    </>
  );
}

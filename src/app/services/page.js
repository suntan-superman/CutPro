import Link from "next/link";
import { services } from "@/data/services";
import { createMetadata } from "@/lib/seo";
import { ArrowIcon } from "@/components/ui/Icons";
import MediaPlaceholder from "@/components/ui/MediaPlaceholder";
import CallToAction from "@/components/ui/CallToAction";
import { getPublicGallery } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = createMetadata({
  title: "Tree Services",
  description: "Explore tree trimming, tree removal, stump grinding, and emergency tree service from CutPro in Bakersfield.",
  path: "/services",
});

export default async function ServicesPage() {
  const gallery = await getPublicGallery({ limit: 100 });
  const photoByService = new Map();
  for (const item of gallery) {
    if (item.service_slug && !photoByService.has(item.service_slug)) photoByService.set(item.service_slug, item);
  }
  return (
    <>
      <header className="page-hero"><div className="shell"><p className="eyebrow">CutPro services</p><h1>Start with the work you need done.</h1><p>Four focused services, one simple way to send CutPro the site details and photos that matter.</p></div></header>
      <section className="section">
        <div className="shell service-list">
          {services.map((service, index) => (
            <article className="service-row" key={service.slug}>
              {photoByService.get(service.slug) ? <ServicePhoto item={photoByService.get(service.slug)} compact /> : <MediaPlaceholder label={`${service.name} project photo pending`} compact />}
              <div><span className="service-number">0{index + 1}</span><p className="eyebrow">{service.eyebrow}</p><h2>{service.name}</h2><p>{service.description}</p><div className="inline-actions"><Link href={`/services/${service.slug}`} className="button button-dark">View service <ArrowIcon className="size-5" /></Link><Link className="text-link" href={`/free-estimate?service=${service.slug}`}>Request this service</Link></div></div>
            </article>
          ))}
        </div>
      </section>
      <CallToAction />
    </>
  );
}

function ServicePhoto({ item, compact = false }) {
  return <div className={`service-photo ${compact ? "service-photo-compact" : ""}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.public_url} alt={item.alt_text} loading="lazy" />{item.caption && <span>{item.caption}</span>}</div>;
}

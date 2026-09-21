import Link from "next/link";
import { services } from "@/data/services";
import { createMetadata } from "@/lib/seo";
import { ArrowIcon } from "@/components/ui/Icons";
import MediaPlaceholder from "@/components/ui/MediaPlaceholder";
import CallToAction from "@/components/ui/CallToAction";

export const metadata = createMetadata({
  title: "Tree Services",
  description: "Explore tree trimming, tree removal, stump grinding, and emergency tree service from CutPro in Bakersfield.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <header className="page-hero"><div className="shell"><p className="eyebrow">CutPro services</p><h1>Start with the work you need done.</h1><p>Four focused services, one simple way to send CutPro the site details and photos that matter.</p></div></header>
      <section className="section">
        <div className="shell service-list">
          {services.map((service, index) => (
            <article className="service-row" key={service.slug}>
              <MediaPlaceholder label={`${service.name} project photo pending`} compact />
              <div><span className="service-number">0{index + 1}</span><p className="eyebrow">{service.eyebrow}</p><h2>{service.name}</h2><p>{service.description}</p><div className="inline-actions"><Link href={`/services/${service.slug}`} className="button button-dark">View service <ArrowIcon className="size-5" /></Link><Link className="text-link" href={`/free-estimate?service=${service.slug}`}>Request this service</Link></div></div>
            </article>
          ))}
        </div>
      </section>
      <CallToAction />
    </>
  );
}


import Link from "next/link";
import { notFound } from "next/navigation";
import { business } from "@/data/business";
import { getServiceArea, serviceAreas } from "@/data/serviceAreas";
import { services } from "@/data/services";
import { breadcrumbJsonLd, createMetadata } from "@/lib/seo";
import JsonLd from "@/components/ui/JsonLd";
import CallToAction from "@/components/ui/CallToAction";

export function generateStaticParams() { return serviceAreas.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }) {
  const { slug } = await params; const area = getServiceArea(slug); if (!area) return {};
  return createMetadata({ title: area.title, description: area.description, path: `/service-areas/${slug}` });
}

export default async function ServiceAreaPage({ params }) {
  const { slug } = await params; const area = getServiceArea(slug); if (!area) notFound();
  return (
    <><JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Service Areas", path: "/service-areas" }, { name: area.name, path: `/service-areas/${slug}` }])} /><header className="page-hero"><div className="shell"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><Link href="/service-areas">Service Areas</Link><span>/</span>{area.name}</div><p className="eyebrow">Local service</p><h1>{area.title}</h1><p>{area.description}</p></div></header><section className="section"><div className="shell grid-two"><div><h2>Tell CutPro where the work is.</h2><p className="large-copy">{area.neighborhoods}</p><p>CutPro&apos;s request form gathers the property address and job details together. It does not confirm service availability or an appointment until the team follows up.</p></div><div className="area-map"><div className="map-road road-one" /><div className="map-road road-two" /><div className="map-ring"><span>{area.name}</span></div></div></div></section><section className="section section-cream"><div className="shell"><div className="section-heading"><p className="eyebrow">Services in {area.name}</p><h2>Choose the closest fit.</h2></div><div className="related-grid">{services.map((service) => <Link href={`/services/${service.slug}`} key={service.slug}><span>{service.name}</span><small>{service.shortDescription}</small><strong>Learn more →</strong></Link>)}</div></div></section><CallToAction title={`Need tree service in ${area.name}?`} copy={`Send the property details and optional photos, or call ${business.phoneDisplay} to start the conversation.`} /></>
  );
}


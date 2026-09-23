import Link from "next/link";
import { serviceAreas } from "@/data/serviceAreas";
import { createMetadata } from "@/lib/seo";
import CallToAction from "@/components/ui/CallToAction";
import ServiceAreaMap from "@/components/ui/ServiceAreaMap";

export const metadata = createMetadata({ title: "Service Areas", description: "CutPro tree service coverage in Bakersfield and surrounding areas, subject to job location and scope.", path: "/service-areas" });

export default function ServiceAreasPage() {
  return (
    <><header className="page-hero"><div className="shell"><p className="eyebrow">Service area</p><h1>Bakersfield first. Nearby requests welcome.</h1><p>Coverage outside Bakersfield depends on the job location, access, and scope. Send the address so CutPro can confirm.</p></div></header><section className="section"><div className="shell grid-two"><div className="area-cards">{serviceAreas.map((area) => <Link href={`/service-areas/${area.slug}`} key={area.slug}><p className="eyebrow">California</p><h2>{area.name}</h2><p>{area.description}</p><strong>View local service details →</strong></Link>)}</div><ServiceAreaMap /></div></section><CallToAction /></>
  );
}

import { getPublicGallery } from "@/lib/data";
import { createMetadata } from "@/lib/seo";
import MediaPlaceholder from "@/components/ui/MediaPlaceholder";
import CallToAction from "@/components/ui/CallToAction";

export const metadata = createMetadata({ title: "Tree Service Gallery", description: "Explore CUTPRO tree service project photos from Bakersfield and surrounding areas.", path: "/gallery" });
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const items = await getPublicGallery({ limit: 60 });
  return (
    <>
      <header className="page-hero"><div className="shell"><p className="eyebrow">Project gallery</p><h1>Our Work</h1><p>Explore CUTPRO tree service projects throughout Bakersfield and surrounding areas. See the care and attention we bring to each property.</p></div></header>
      <section className="section"><div className="shell">
        {items.length ? <div className="gallery-grid">{items.map((item) => <figure key={item.id}><div className="gallery-image">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.public_url} alt={item.alt_text} loading="lazy" /></div><figcaption><strong>{item.category}</strong>{item.caption && <span>{item.caption}</span>}</figcaption></figure>)}</div> : <div className="empty-gallery"><MediaPlaceholder label="CUTPRO project photos coming soon" /><div><h2>See what is possible for your property.</h2><p>Project photos are coming soon. Tell us about your trees and the work you have in mind, or send photos with your estimate request.</p></div></div>}
      </div></section>
      <CallToAction />
    </>
  );
}

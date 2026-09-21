import { getPublicGallery } from "@/lib/data";
import { createMetadata } from "@/lib/seo";
import MediaPlaceholder from "@/components/ui/MediaPlaceholder";
import CallToAction from "@/components/ui/CallToAction";

export const metadata = createMetadata({ title: "Tree Service Gallery", description: "Browse published CutPro tree trimming, removal, stump grinding, and project photos.", path: "/gallery" });
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const items = await getPublicGallery({ limit: 60 });
  return (
    <>
      <header className="page-hero"><div className="shell"><p className="eyebrow">Project gallery</p><h1>Work you can see.</h1><p>Published CutPro project photos, added and maintained directly by the team.</p></div></header>
      <section className="section"><div className="shell">
        {items.length ? <div className="gallery-grid">{items.map((item) => <figure key={item.id}><div className="gallery-image">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.public_url} alt={item.alt_text} loading="lazy" /></div><figcaption><strong>{item.category}</strong>{item.caption && <span>{item.caption}</span>}</figcaption></figure>)}</div> : <div className="empty-gallery"><MediaPlaceholder label="Authentic CutPro project photos coming soon" /><div><h2>The gallery is ready for CutPro&apos;s work.</h2><p>No stock jobs or invented results are shown. Customer-approved project photos can be published here from the secure admin portal.</p></div></div>}
      </div></section>
      <CallToAction />
    </>
  );
}


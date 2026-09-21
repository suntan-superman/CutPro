import Link from "next/link";
import MediaPlaceholder from "@/components/ui/MediaPlaceholder";

export default function HomeGallery({ items }) {
  const visibleItems = items.slice(0, 3);
  return (
    <div className="work-grid">
      {visibleItems.length
        ? visibleItems.map((item, index) => (
            <figure className={`work-card work-card-${index + 1}`} key={item.id}>
              {/* Admin-managed URLs are already optimized for web delivery at upload time. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.public_url} alt={item.alt_text} loading={index ? "lazy" : "eager"} />
              {(item.caption || item.category) && <figcaption>{item.caption || item.category}</figcaption>}
            </figure>
          ))
        : ["Tree trimming project", "Tree removal project", "Stump grinding project"].map((label, index) => (
            <MediaPlaceholder key={label} label={`${label} photo pending`} compact={index > 0} className={`work-card work-card-${index + 1}`} />
          ))}
      <div className="work-grid-copy">
        <p className="eyebrow">Real work. Real results.</p>
        <h2>See the work before you make the call.</h2>
        <p>CutPro&apos;s project gallery is managed by the team. Authentic, customer-approved job photos will appear here as they are published.</p>
        <Link href="/gallery" className="text-link">Explore the gallery →</Link>
      </div>
    </div>
  );
}


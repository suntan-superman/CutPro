import Link from "next/link";
import { business } from "@/data/business";
import { createMetadata } from "@/lib/seo";
import MediaPlaceholder from "@/components/ui/MediaPlaceholder";
import SectionHeading from "@/components/ui/SectionHeading";
import CallToAction from "@/components/ui/CallToAction";
import { getPublicGallery } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = createMetadata({ title: "About", description: `Learn how ${business.name} approaches tree-service requests in Bakersfield.`, path: "/about" });

export default async function AboutPage() {
  const [teamPhoto] = await getPublicGallery({ teamPhoto: true, limit: 1 });
  return (
    <>
      <header className="page-hero"><div className="shell"><p className="eyebrow">About CutPro</p><h1>Local tree work starts with listening.</h1><p>CutPro helps property owners explain what they need, understand the proposed scope, and move the work forward.</p></div></header>
      <section className="section"><div className="shell grid-two">{teamPhoto ? <figure className="about-team-photo">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={teamPhoto.public_url} alt={teamPhoto.alt_text} />{teamPhoto.caption && <figcaption>{teamPhoto.caption}</figcaption>}</figure> : <MediaPlaceholder label="CutPro team photo pending" />}<div><SectionHeading eyebrow="The CutPro approach" title="A practical path from concern to plan." /><p className="large-copy">No two properties present the same access, tree, or end goal. CutPro begins with the job in front of you and the result you want from the space.</p><p>This website is designed the same way: a clear phone number, straightforward service information, and one mobile-friendly place to send the details.</p><Link href="/free-estimate" className="button button-dark">Tell us about the job</Link></div></div></section>
      <section className="section section-cream"><div className="shell"><SectionHeading eyebrow="What you can expect" title="Useful information, gathered once." /><div className="values-grid">{[["A clear starting point", "Choose a service or describe a situation that does not fit a label."], ["Context from your property", "Add address, timing, access notes, and photos in one request."], ["A direct follow-up", "CutPro receives the complete request and contacts you using your preferred method."]].map(([title, copy]) => <article key={title}><h2>{title}</h2><p>{copy}</p></article>)}</div></div></section>
      <CallToAction />
    </>
  );
}

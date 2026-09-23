import Link from "next/link";
import { business } from "@/data/business";
import { createMetadata } from "@/lib/seo";
import MediaPlaceholder from "@/components/ui/MediaPlaceholder";
import { PhoneIcon } from "@/components/ui/Icons";
import { getCompanyContent, getPublicGallery } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = createMetadata({ title: "About", description: "Meet CUTPRO Tree Service, a locally owned Bakersfield company with more than 10 years of experience in tree trimming, removal, stump grinding, and emergency tree service.", path: "/about" });

export default async function AboutPage() {
  const [content, [teamPhoto]] = await Promise.all([getCompanyContent(), getPublicGallery({ teamPhoto: true, limit: 1 })]);
  return (
    <>
      <header className="page-hero company-copy"><div className="shell"><p className="eyebrow">{content.companyName}</p><h1>{content.aboutHeading}</h1><p>{content.yearsDisplay}</p></div></header>
      <section className="section"><div className="shell grid-two about-story">
        {teamPhoto ? <figure className="about-team-photo">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={teamPhoto.public_url} alt={teamPhoto.alt_text} />{teamPhoto.caption && <figcaption>{teamPhoto.caption}</figcaption>}</figure> : <MediaPlaceholder label="CUTPRO team photo coming soon" />}
        <div className="company-copy about-paragraphs">{content.aboutParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      </div></section>
      <section className="section section-cream"><div className="shell company-copy">
        <div className="section-heading"><h2>{content.localHeading}</h2><p className="section-copy">{content.localParagraph}</p></div>
        <div className="inline-actions"><Link href="/free-estimate" className="button button-primary">Get a Free Estimate</Link><a href={business.phoneHref} className="button button-outline" data-phone-cta><PhoneIcon className="size-5" /> {business.phoneDisplay}</a></div>
      </div></section>
    </>
  );
}

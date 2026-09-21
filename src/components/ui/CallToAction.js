import Link from "next/link";
import { business } from "@/data/business";
import { ArrowIcon, PhoneIcon } from "@/components/ui/Icons";

export default function CallToAction({
  title = "Show us what your property needs.",
  copy = "Tell us about the job and add photos from your phone. CutPro will follow up to discuss the next step.",
  tone = "dark",
}) {
  return (
    <section className={`cta-panel ${tone === "light" ? "cta-panel-light" : ""}`}>
      <div>
        <p className="eyebrow">Start with the details</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <div className="cta-actions">
        <Link href="/free-estimate" className="button button-primary">
          Get a Free Estimate <ArrowIcon className="size-5" />
        </Link>
        <a href={business.phoneHref} className="button button-ghost" data-phone-cta>
          <PhoneIcon className="size-5" /> Call {business.phoneDisplay}
        </a>
      </div>
    </section>
  );
}


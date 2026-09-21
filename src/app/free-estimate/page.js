import { Suspense } from "react";
import { business } from "@/data/business";
import { createMetadata } from "@/lib/seo";
import EstimateForm from "@/components/estimate/EstimateForm";
import { PhoneIcon } from "@/components/ui/Icons";

export const metadata = createMetadata({ title: "Free Tree Service Estimate", description: "Request a CutPro tree-service estimate and add property photos from your phone.", path: "/free-estimate" });

export default function FreeEstimatePage() {
  return <><header className="estimate-hero"><div className="shell"><div><p className="eyebrow">Free estimate request</p><h1>Show us the job.</h1><p>Five short steps keep the service, property details, and photos together.</p></div><a href={business.phoneHref} data-phone-cta><PhoneIcon className="size-5" /><span>Prefer to call?</span><strong>{business.phoneDisplay}</strong></a></div></header><section className="estimate-section"><div className="shell"><Suspense fallback={<div className="estimate-loading">Preparing your request…</div>}><EstimateForm /></Suspense></div></section></>;
}


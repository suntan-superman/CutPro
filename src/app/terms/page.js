import { business } from "@/data/business";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({ title: "Website Terms", description: `Terms for using the ${business.name} website and estimate request form.`, path: "/terms" });

export default function TermsPage() {
  return <><header className="page-hero legal-hero"><div className="shell"><p className="eyebrow">Legal</p><h1>Website Terms</h1><p>Last updated September 20, 2026</p></div></header><article className="shell legal-copy"><h2>Website purpose</h2><p>This website provides general information about CutPro services and a way to request contact. Content is not a professional tree-risk assessment, quote, contract, or confirmed appointment.</p><h2>Estimate requests</h2><p>Submitting a form does not guarantee service availability, timing, price, or acceptance of a job. CutPro must review the actual conditions and agree to the scope.</p><h2>Urgent conditions</h2><p>Do not use this website as an emergency dispatch service. If a tree or limb involves utility lines, fire, injury, an immediate threat to life, or blocked emergency access, stay away and contact the appropriate utility or emergency service.</p><h2>Your submissions</h2><p>You confirm that information and photos you submit are accurate to your knowledge and that you have permission to share them for evaluating the requested work. Do not upload sensitive documents or unrelated personal information.</p><h2>Site availability</h2><p>The website may occasionally be unavailable or contain errors. CutPro may update these terms and site content as operations change.</p><h2>Contact</h2><p>Questions about these terms can be directed to CutPro at <a href={business.phoneHref}>{business.phoneDisplay}</a>.</p></article></>;
}


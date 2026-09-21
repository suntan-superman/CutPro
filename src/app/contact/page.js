import { business } from "@/data/business";
import { createMetadata } from "@/lib/seo";
import { getBusinessSettings } from "@/lib/data";
import ContactForm from "@/components/forms/ContactForm";
import { PhoneIcon } from "@/components/ui/Icons";

export const metadata = createMetadata({ title: "Contact", description: `Contact ${business.name} about tree service in Bakersfield.`, path: "/contact" });

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const settings = await getBusinessSettings();
  return <><header className="page-hero"><div className="shell"><p className="eyebrow">Contact CutPro</p><h1>Let&apos;s talk about the property.</h1><p>For a detailed job request with photos, use the Free Estimate form. For a general question, send a message here.</p></div></header><section className="section"><div className="shell contact-layout"><aside><p className="eyebrow">Call directly</p><a className="contact-phone" href={business.phoneHref} data-phone-cta><PhoneIcon className="size-7" />{business.phoneDisplay}</a>{settings.business_hours && <p><strong>Business hours</strong><br />{settings.business_hours}</p>}<p>{settings.after_hours_note || business.afterHoursNote}</p><hr /><h2>Before you send</h2><p>Do not use this form for immediate threats to life, fire, injury, or utility-line contact. Contact the appropriate emergency service or utility and stay clear of the area.</p></aside><div><h2>Send a general message</h2><ContactForm /></div></div></section></>;
}

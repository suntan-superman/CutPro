import Link from "next/link";
import { business } from "@/data/business";
import { PhoneIcon } from "@/components/ui/Icons";

export default function MobileActionBar() {
  return (
    <div className="mobile-action-bar" aria-label="Quick actions">
      <a href={business.phoneHref} data-phone-cta><PhoneIcon className="size-5" /> Call now</a>
      <Link href="/free-estimate">Free estimate</Link>
    </div>
  );
}


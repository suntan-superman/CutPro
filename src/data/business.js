import { getBusinessPhone } from "../lib/phone.js";

const configuredPhone = process.env.NEXT_PUBLIC_BUSINESS_PHONE?.trim()
  || process.env.NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY?.trim()
  || "+16613437663";

export const business = {
  name: "CUTPRO Tree Service",
  shortName: "CUTPRO",
  ...getBusinessPhone(configuredPhone),
  email: null,
  canonicalUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  tagline: "Professional Tree Care in Bakersfield & Surrounding Areas",
  summary:
    "CUTPRO Tree Service provides tree trimming, tree removal, stump grinding, and emergency tree service in Bakersfield and surrounding areas.",
  primaryCity: "Bakersfield",
  region: "CA",
  areaServed: ["Bakersfield", "Kern County"],
  hours: null,
  afterHoursNote:
    "For urgent tree concerns, call to describe the situation and confirm availability.",
  emergencyServiceAvailable: true,
  announcement: null,
  socialLinks: [],
  license: null,
  address: null,
};

export const primaryNavigation = [
  { href: "/services", label: "Services" },
  { href: "/service-areas", label: "Service Areas" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

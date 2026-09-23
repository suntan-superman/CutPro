import { business } from "@/data/business";

export function absoluteUrl(path = "/") {
  return new URL(path, business.canonicalUrl).toString();
}

export function createMetadata({ title, description, path = "/", image }) {
  const fullTitle = title.includes(business.name)
    ? title
    : `${title} | ${business.name}`;
  const canonical = absoluteUrl(path);

  return {
    title:
      path === "/" || title.includes(business.name)
        ? { absolute: fullTitle }
        : title,
    description,
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: business.name,
      locale: "en_US",
      type: "website",
      ...(image ? { images: [{ url: absoluteUrl(image) }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: fullTitle,
      description,
    },
  };
}

export function localBusinessJsonLd(settings = {}) {
  const hours = settings.business_hours || business.hours;
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: business.name,
    url: business.canonicalUrl,
    ...(business.phoneE164 ? { telephone: business.phoneE164 } : {}),
    description: business.summary,
    areaServed: business.areaServed.map((name) => ({
      "@type": "AdministrativeArea",
      name,
    })),
    ...(business.address ? { address: business.address } : {}),
    ...(hours ? { openingHours: hours } : {}),
    ...(business.socialLinks.length ? { sameAs: business.socialLinks } : {}),
  };
}

export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

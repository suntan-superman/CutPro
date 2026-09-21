import { business } from "@/data/business";

export default function robots() {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] }], sitemap: new URL("/sitemap.xml", business.canonicalUrl).toString() };
}


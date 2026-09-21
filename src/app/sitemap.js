import { business } from "@/data/business";
import { services } from "@/data/services";
import { serviceAreas } from "@/data/serviceAreas";

export default function sitemap() {
  const paths = ["", "/services", "/service-areas", "/about", "/gallery", "/free-estimate", "/contact", "/privacy", "/terms", ...services.map((item) => `/services/${item.slug}`), ...serviceAreas.map((item) => `/service-areas/${item.slug}`)];
  return paths.map((path) => ({ url: new URL(path || "/", business.canonicalUrl).toString(), lastModified: new Date(), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/free-estimate" ? 0.9 : 0.7 }));
}


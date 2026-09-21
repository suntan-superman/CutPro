import { Suspense } from "react";
import "./globals.css";
import { business } from "@/data/business";
import SiteChrome from "@/components/layout/SiteChrome";
import Analytics from "@/components/analytics/Analytics";
import JsonLd from "@/components/ui/JsonLd";
import { localBusinessJsonLd } from "@/lib/seo";

export const metadata = {
  metadataBase: new URL(business.canonicalUrl),
  title: { default: business.tagline, template: `%s | ${business.name}` },
  description: business.summary,
  applicationName: business.name,
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#153b2e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={localBusinessJsonLd()} />
        <SiteChrome>{children}</SiteChrome>
        <Suspense><Analytics /></Suspense>
      </body>
    </html>
  );
}

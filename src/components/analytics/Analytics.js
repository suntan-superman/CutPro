"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

export default function Analytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!measurementId) return;
    window.gtag?.("config", measurementId, {
      page_path: `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`,
    });
  }, [measurementId, pathname, searchParams]);

  useEffect(() => {
    const onClick = (event) => {
      const link = event.target.closest("[data-phone-cta]");
      if (link) trackEvent("phone_cta", { link_url: link.href });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!measurementId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${measurementId}',{send_page_view:false});`}
      </Script>
    </>
  );
}


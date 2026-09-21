"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

export default function TurnstileWidget({ onToken }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetRef.current !== null) return;
    widgetRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
      theme: "light",
    });
  }, [onToken, siteKey]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (window.turnstile && widgetRef.current !== null) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [renderWidget]);

  if (!siteKey) return null;
  return (
    <div className="turnstile-wrap">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={renderWidget} />
      <div ref={containerRef} />
    </div>
  );
}


export function trackEvent(name, parameters = {}) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("event", name, parameters);
  }
}


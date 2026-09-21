export function getSessionCookieOptions(requestHeaders, siteUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  let configuredUrl;
  try {
    configuredUrl = new URL(siteUrl);
  } catch {
    // The request still supplies the local/HTTPS information when no site URL is set.
  }

  const requestHost = requestHeaders?.get("host") || requestHeaders?.get("x-forwarded-host")?.split(",")[0]?.trim();
  let hostname = configuredUrl?.hostname || "";
  if (requestHost) {
    try {
      hostname = new URL(`http://${requestHost}`).hostname;
    } catch {
      hostname = "";
    }
  }

  const localHost = hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || /^127\./.test(hostname);
  const forwardedProtocol = requestHeaders?.get("x-forwarded-proto")?.split(",")[0]?.trim();

  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: !localHost && Boolean(forwardedProtocol === "https" || configuredUrl?.protocol === "https:"),
  };
}

export function getProjectAuthCookieNames(allCookies, supabaseUrl) {
  if (!supabaseUrl) return [];
  const project = new URL(supabaseUrl).hostname.split(".")[0];
  const authName = `sb-${project}-auth-token`;
  const baseNames = [authName, `${authName}-code-verifier`];
  const names = new Set(baseNames);
  for (const { name } of allCookies) {
    if (baseNames.some((base) => name === base || (name.startsWith(base) && /^\.\d+$/.test(name.slice(base.length))))) {
      names.add(name);
    }
  }
  return [...names];
}

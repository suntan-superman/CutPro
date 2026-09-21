import { getProjectAuthCookieNames } from "./sessionCookies.js";

export async function logoutSession({ createClient, cookieStore, supabaseUrl, cookieOptions }) {
  const originalCookieNames = getProjectAuthCookieNames(cookieStore.getAll(), supabaseUrl);
  let revocationFailed = false;

  try {
    const client = await createClient();
    if (client) {
      const { error } = await client.auth.signOut();
      revocationFailed = Boolean(error);
    }
  } catch {
    revocationFailed = true;
  } finally {
    // Supabase can return before removing local cookies when revocation fails.
    // Expire only this project's auth cookies, including any chunked values.
    const names = new Set([
      ...originalCookieNames,
      ...getProjectAuthCookieNames(cookieStore.getAll(), supabaseUrl),
    ]);
    for (const name of names) {
      cookieStore.set(name, "", { ...cookieOptions, maxAge: 0, expires: new Date(0) });
    }
  }

  return { revocationFailed };
}

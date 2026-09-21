"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ setupRequired = false }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault(); setStatus("submitting"); setMessage("");
    try {
      const response = await fetch("/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Sign in failed.");
      router.replace("/admin"); router.refresh();
    } catch (error) { setStatus("error"); setMessage(error.message); }
  };

  return <form className="login-form" onSubmit={submit}>{setupRequired && <div className="admin-notice">The managed database and authentication environment variables must be configured before admin sign-in. See the README setup guide.</div>}<div className="field"><label htmlFor="adminEmail">Email</label><input id="adminEmail" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="field"><label htmlFor="adminPassword">Password</label><input id="adminPassword" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>{message && <div className="form-alert error" role="alert">{message}</div>}<button type="submit" className="button button-primary" disabled={status === "submitting"}>{status === "submitting" ? "Signing in…" : "Sign in"}</button><p>Accounts are provisioned by the site administrator. There is no public registration.</p></form>;
}


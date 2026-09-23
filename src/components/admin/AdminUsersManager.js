"use client";

import { useEffect, useState } from "react";

export default function AdminUsersManager() {
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState("loading");

  const load = async () => {
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setAdmins(result.admins || []); setState("ready");
    } catch (error) { setMessage(error.message); setState("error"); }
  };
  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, []);

  const add = async (event) => {
    event.preventDefault(); setState("saving"); setMessage("");
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, displayName }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setEmail(""); setDisplayName(""); setMessage("Administrator added. They can use the invitation email to finish signing in."); await load();
    } catch (error) { setMessage(error.message); setState("error"); }
  };

  const deactivate = async (userId, address) => {
    if (!window.confirm(`Deactivate ${address || "this administrator"}? They will no longer be able to use the owner portal.`)) return;
    setState("saving"); setMessage("");
    try {
      const response = await fetch("/api/admin/users", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage("Administrator deactivated."); await load();
    } catch (error) { setMessage(error.message); setState("error"); }
  };

  return <section className="admin-card admin-form"><h2>Administrator access</h2><p>Add another administrator by email or deactivate an existing portal account. Deactivation removes portal access but does not delete the Supabase login identity.</p><form onSubmit={add}><div className="form-grid"><div className="field"><label htmlFor="newAdminEmail">Email</label><input id="newAdminEmail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="field"><label htmlFor="newAdminName">Display name</label><input id="newAdminName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Example: Office manager" /></div></div><button className="button button-dark" type="submit" disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Add administrator"}</button></form>{message && <div className={`admin-feedback ${state === "error" ? "error" : "saved"}`}>{message}</div>}<hr /><h3>Active administrators</h3>{state === "loading" ? <p>Loading…</p> : <ul className="simple-admin-list">{admins.map((admin) => <li key={admin.userId}><span><strong>{admin.displayName}</strong><small>{admin.email}</small></span><button className="button button-outline" type="button" onClick={() => deactivate(admin.userId, admin.email)}>Deactivate</button></li>)}</ul>}</section>;
}

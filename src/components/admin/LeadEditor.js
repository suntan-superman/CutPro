"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const statuses = [
  ["new", "New"], ["contacted", "Contacted"], ["estimate_scheduled", "Estimate scheduled"], ["won", "Won"], ["lost", "Lost"],
];

export default function LeadEditor({ lead }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const [internalNotes, setInternalNotes] = useState(lead.internal_notes || "");
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  const save = async () => {
    setState("saving"); setMessage("");
    try {
      const response = await fetch(`/api/admin/leads/${lead.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, internalNotes }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Changes could not be saved.");
      setState("saved"); setMessage("Lead updated."); router.refresh();
    } catch (error) { setState("error"); setMessage(error.message); }
  };
  return <section className="admin-card lead-editor"><h2>Follow-up</h2><div className="field"><label htmlFor="leadStatus">Lead status</label><select id="leadStatus" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label htmlFor="internalNotes">Private notes</label><textarea id="internalNotes" rows="9" maxLength="5000" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Add call outcomes, appointment details, or next steps. These notes are never shown to the customer." /></div>{message && <div className={`admin-feedback ${state}`}>{message}</div>}<button className="button button-dark" type="button" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save follow-up"}</button></section>;
}


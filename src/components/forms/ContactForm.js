"use client";

import { useCallback, useState } from "react";
import TurnstileWidget from "@/components/forms/TurnstileWidget";
import { CheckIcon } from "@/components/ui/Icons";
import { trackEvent } from "@/lib/analytics";

export default function ContactForm() {
  const [fields, setFields] = useState({ firstName: "", lastName: "", phone: "", email: "", message: "", website: "" });
  const [submissionToken] = useState(() => globalThis.crypto?.randomUUID?.() || "33333333-3333-4333-8333-333333333333");
  const [startedAt] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});

  const setToken = useCallback((token) => setTurnstileToken(token), []);
  const change = (event) => { setFields((current) => ({ ...current, [event.target.name]: event.target.value })); setErrors((current) => ({ ...current, [event.target.name]: undefined })); };

  const submit = async (event) => {
    event.preventDefault(); setStatus("submitting"); setMessage("");
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...fields, submissionToken, startedAt, turnstileToken }) });
      const result = await response.json();
      if (!response.ok) { setErrors(result.errors || {}); throw new Error(result.message || "Your message could not be sent."); }
      setStatus("success"); setMessage(`Your message was saved as ${result.reference}. CutPro can follow up using the details you provided.`); trackEvent("contact_submit", { lead_reference: result.reference });
    } catch (error) { setStatus("error"); setMessage(error.message); }
  };

  if (status === "success") return <div className="form-success compact-success"><div className="success-mark"><CheckIcon className="size-8" /></div><h2>Message received.</h2><p>{message}</p></div>;
  return <form className="contact-form" onSubmit={submit} noValidate><div className="form-grid"><div className="field"><label htmlFor="contactFirstName">First name <span>*</span></label><input id="contactFirstName" name="firstName" autoComplete="given-name" value={fields.firstName} onChange={change} /><FieldError message={errors.firstName} /></div><div className="field"><label htmlFor="contactLastName">Last name</label><input id="contactLastName" name="lastName" autoComplete="family-name" value={fields.lastName} onChange={change} /></div><div className="field"><label htmlFor="contactPhone">Phone <span>*</span></label><input id="contactPhone" name="phone" type="tel" autoComplete="tel" value={fields.phone} onChange={change} /><FieldError message={errors.phone} /></div><div className="field"><label htmlFor="contactEmail">Email</label><input id="contactEmail" name="email" type="email" autoComplete="email" value={fields.email} onChange={change} /><FieldError message={errors.email} /></div><div className="field full"><label htmlFor="contactMessage">How can we help? <span>*</span></label><textarea id="contactMessage" name="message" rows="7" value={fields.message} onChange={change} maxLength="2000" /><FieldError message={errors.message} /></div></div><div className="honey-field" aria-hidden="true"><label htmlFor="companyWebsite">Website</label><input id="companyWebsite" name="website" tabIndex="-1" autoComplete="off" value={fields.website} onChange={change} /></div><TurnstileWidget onToken={setToken} />{message && <div className="form-alert error" role="alert">{message}</div>}<button type="submit" className="button button-primary" disabled={status === "submitting"}>{status === "submitting" ? "Sending…" : "Send message"}</button></form>;
}

function FieldError({ message }) { return message ? <span className="field-error" role="alert">{message}</span> : null; }

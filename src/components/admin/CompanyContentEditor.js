"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { companyContentLimits } from "@/data/companyContent";
import { validateCompanyContent } from "@/lib/companyContent";

export default function CompanyContentEditor() {
  const [values, setValues] = useState(null);
  const [saved, setSaved] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/admin/company", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Company content could not be loaded.");
        if (controller.signal.aborted) return;
        setValues(result.content); setSaved(result.content); setUpdatedAt(result.updatedAt); setStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setMessage(error.message); setStatus("error");
      }
    }
    load();
    return () => controller.abort();
  }, [attempt]);

  const dirty = values && JSON.stringify(values) !== JSON.stringify(saved);
  const change = (key, value, index) => {
    setValues((current) => ({ ...current, [key]: index === undefined ? value : current[key].map((item, i) => i === index ? value : item) }));
    setErrors((current) => ({ ...current, [index === undefined ? key : `aboutParagraph${index + 1}`]: undefined }));
    setMessage(""); setStatus("ready");
  };
  const submit = async (event) => {
    event.preventDefault();
    const validation = validateCompanyContent(values);
    setErrors(validation.errors);
    if (!validation.valid) { setMessage("Review the highlighted fields."); setStatus("error"); return; }
    setStatus("saving"); setMessage("");
    try {
      const response = await fetch("/api/admin/company", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(validation.data) });
      const result = await response.json();
      if (!response.ok) { setErrors(result.errors || {}); throw new Error(result.message || "Company content could not be saved."); }
      setValues(result.content); setSaved(result.content); setUpdatedAt(result.updatedAt);
      setStatus("saved"); setMessage("Company content saved. Your About page is updated.");
    } catch (error) { setStatus("error"); setMessage(error.message); }
  };

  if (!values) return <section className="admin-card" aria-busy={status === "loading"}>
    {status === "loading" ? <p role="status">Loading company content…</p> : <><p role="alert">{message}</p><button type="button" className="button button-dark" onClick={() => { setStatus("loading"); setMessage(""); setAttempt((value) => value + 1); }}>Retry loading</button></>}
  </section>;

  function field(key, label, index) {
    const id = index === undefined ? key : `aboutParagraph${index + 1}`;
    const props = { id, value: index === undefined ? values[key] : values[key][index], maxLength: companyContentLimits[key], required: true, onChange: (event) => change(key, event.target.value, index), "aria-invalid": Boolean(errors[id]), "aria-describedby": errors[id] ? `${id}-error` : undefined };
    return <div className="field" key={id}><label htmlFor={id}>{label}</label>
      {key === "aboutParagraphs" || key === "localParagraph" ? <textarea {...props} rows={5} /> : <input {...props} />}
      {errors[id] && <span id={`${id}-error`} className="field-error" role="alert">{errors[id]}</span>}
    </div>;
  }

  return <div className="admin-stack">
    <form className="admin-card admin-form company-editor" onSubmit={submit} noValidate aria-busy={status === "saving"}>
      <h2>Company / About</h2><p>Edit the company information shown on the About page. Use plain text and only confirmed company facts. The company name here labels the About page; the site logo and navigation keep the CUTPRO brand.</p>
      <fieldset disabled={status === "saving"}>
        <div className="form-grid">{field("companyName", "Company name")}{field("yearsDisplay", "Years / experience display")}</div>
        {field("aboutHeading", "About heading")}
        {[0, 1, 2, 3].map((index) => field("aboutParagraphs", `About paragraph ${index + 1}`, index))}
        {field("localHeading", "Local section heading")}{field("localParagraph", "Local section paragraph")}
      </fieldset>
      {message && <p className={`admin-feedback ${status}`} role={status === "error" ? "alert" : "status"}>{message}</p>}
      <div className="inline-actions"><button className="button button-dark" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save company content"}</button><Link href="/about" target="_blank" rel="noopener noreferrer" className="text-link">View About page ↗</Link></div>
      <p className="company-save-status">{dirty ? "Unsaved changes" : "No unsaved changes"}{updatedAt && ` · Last saved ${new Date(updatedAt).toLocaleString()}`}</p>
    </form>
    <details className="admin-card company-copy company-preview"><summary>Preview About content</summary>
      <p className="eyebrow">{values.companyName}</p><h2>{values.aboutHeading}</h2><p>{values.yearsDisplay}</p>
      {values.aboutParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      <h3>{values.localHeading}</h3><p>{values.localParagraph}</p>
    </details>
  </div>;
}

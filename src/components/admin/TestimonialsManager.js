"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

const empty = { customerName: "", testimonialText: "", source: "Direct Customer", sourceUrl: "", rating: "", featured: false, published: false, sortOrder: 0 };
const sources = ["Google", "Yelp", "Facebook", "Direct Customer", "Other"];

export default function TestimonialsManager({ initialItems }) {
  const router = useRouter(); const [values, setValues] = useState(empty); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const change = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const add = async (event) => { event.preventDefault(); setBusy(true); setMessage(""); try { const response = await fetch("/api/admin/testimonials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setValues(empty); setMessage("Testimonial added."); router.refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } };
  return <><section className="admin-card"><h2>Add a genuine testimonial</h2><p>Publish only customer feedback CutPro has permission to display. A source and rating must match the original.</p><TestimonialForm values={values} change={change} onSubmit={add} submitLabel={busy ? "Adding…" : "Add testimonial"} disabled={busy} />{message && <div className="admin-feedback">{message}</div>}</section><section className="admin-section-heading"><div><h2>Testimonials</h2><p>{initialItems.length} active testimonial{initialItems.length === 1 ? "" : "s"}</p></div></section><div className="admin-stack">{initialItems.map((item) => <TestimonialItem key={item.id} item={item} router={router} />)}{!initialItems.length && <div className="admin-empty">No testimonials have been added. The public site will not show an empty or fabricated review section.</div>}</div></>;
}

function TestimonialForm({ values, change, onSubmit, submitLabel, disabled, showRemove, onRemove }) {
  const formId = useId();
  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${formId}-customer-name`}>Displayed customer name <span>*</span></label>
          <input id={`${formId}-customer-name`} value={values.customerName} onChange={(event) => change("customerName", event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-source`}>Source</label>
          <select id={`${formId}-source`} value={values.source} onChange={(event) => change("source", event.target.value)}>{sources.map((source) => <option key={source}>{source}</option>)}</select>
        </div>
        <div className="field full">
          <label htmlFor={`${formId}-text`}>Testimonial <span>*</span></label>
          <textarea id={`${formId}-text`} rows="5" value={values.testimonialText} onChange={(event) => change("testimonialText", event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-source-url`}>Source link</label>
          <input id={`${formId}-source-url`} type="url" value={values.sourceUrl} onChange={(event) => change("sourceUrl", event.target.value)} placeholder="https://" />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-rating`}>Rating, if supplied</label>
          <select id={`${formId}-rating`} value={values.rating} onChange={(event) => change("rating", event.target.value)}><option value="">No rating</option>{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} star{rating === 1 ? "" : "s"}</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor={`${formId}-sort-order`}>Display order</label>
          <input id={`${formId}-sort-order`} type="number" value={values.sortOrder} onChange={(event) => change("sortOrder", event.target.value)} />
        </div>
      </div>
      <div className="toggle-row">
        <label htmlFor={`${formId}-featured`}><input id={`${formId}-featured`} type="checkbox" checked={values.featured} onChange={(event) => change("featured", event.target.checked)} /> Feature on homepage</label>
        <label htmlFor={`${formId}-published`}><input id={`${formId}-published`} type="checkbox" checked={values.published} onChange={(event) => change("published", event.target.checked)} /> Published</label>
      </div>
      <div className="admin-item-actions">
        <button className="button button-dark" type="submit" disabled={disabled}>{submitLabel}</button>
        {showRemove && <button className="button button-danger" type="button" onClick={onRemove}>Archive</button>}
      </div>
    </form>
  );
}

function TestimonialItem({ item, router }) {
  const [values, setValues] = useState({ customerName: item.customer_name, testimonialText: item.testimonial_text, source: item.source, sourceUrl: item.source_url || "", rating: item.rating || "", featured: item.featured, published: item.published, sortOrder: item.sort_order }); const [state, setState] = useState("idle");
  const change = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const save = async (event) => { event.preventDefault(); setState("saving"); const response = await fetch(`/api/admin/testimonials/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }); setState(response.ok ? "saved" : "error"); if (response.ok) router.refresh(); };
  const remove = async () => { if (!window.confirm("Archive this testimonial? It will immediately disappear from the public site.")) return; const response = await fetch(`/api/admin/testimonials/${item.id}`, { method: "DELETE" }); if (response.ok) router.refresh(); else setState("error"); };
  return <section className="admin-card testimonial-admin-item"><TestimonialForm values={values} change={change} onSubmit={save} submitLabel={state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save changes"} disabled={state === "saving"} showRemove onRemove={remove} />{state === "error" && <span className="field-error">The change could not be saved.</span>}</section>;
}

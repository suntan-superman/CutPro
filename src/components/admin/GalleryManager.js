"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useObjectUrls from "@/hooks/useObjectUrls";

const categories = ["Tree Removal", "Tree Trimming", "Stump Grinding", "Emergency/Storm", "Equipment", "Before & After", "Other"];
const services = [["", "None"], ["tree-removal", "Tree Removal"], ["tree-trimming", "Tree Trimming"], ["stump-grinding", "Stump Grinding"], ["emergency-tree-service", "Emergency Tree Service"]];

export default function GalleryManager({ initialItems }) {
  const router = useRouter();
  const [previews, setPreviews] = useState([]);
  const [upload, setUpload] = useState({ altText: "", caption: "", category: "Other", serviceSlug: "", featured: false, published: false });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { createObjectUrl, clearObjectUrls } = useObjectUrls();

  const selectFiles = (event) => {
    const selected = Array.from(event.target.files || []).slice(0, 6);
    clearObjectUrls();
    setPreviews(selected.map((file) => ({ file, url: createObjectUrl(file) })));
  };

  const uploadFiles = async (event) => {
    event.preventDefault(); if (!previews.length || busy) return; setBusy(true); setMessage("");
    const form = event.currentTarget;
    const body = new FormData(); previews.forEach(({ file }) => body.append("photos", file)); Object.entries(upload).forEach(([key, value]) => body.set(key, String(value)));
    try { const response = await fetch("/api/admin/gallery", { method: "POST", body }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setMessage(`${result.count} photo${result.count === 1 ? "" : "s"} added.`); clearObjectUrls(); setPreviews([]); setUpload({ altText: "", caption: "", category: "Other", serviceSlug: "", featured: false, published: false }); form.reset(); router.refresh(); }
    catch (error) { setMessage(error.message || "Upload failed."); }
    finally { setBusy(false); }
  };

  return <>
    <section className="admin-card">
      <div className="admin-card-heading"><div><h2>Add project photos</h2><p>Upload web-ready JPG, PNG, or WebP images. Published photos can appear immediately on the public site.</p></div></div>
      <form className="admin-form" onSubmit={uploadFiles}>
        <div className="field"><label htmlFor="galleryFiles">Photos (up to 6)</label><input id="galleryFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple required disabled={busy} onChange={selectFiles} /></div>
        {previews.length > 0 && <div className="admin-upload-previews">{previews.map((item) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={item.url} src={item.url} alt="Selected upload preview" />)}</div>}
        <div className="form-grid">
          <div className="field full"><label htmlFor="newAlt">Photo description <span>*</span></label><input id="newAlt" value={upload.altText} onChange={(event) => setUpload((current) => ({ ...current, altText: event.target.value }))} required placeholder="Example: CutPro crew trimming a mature tree beside a Bakersfield home" /></div>
          <div className="field full"><label htmlFor="newCaption">Caption</label><input id="newCaption" value={upload.caption} onChange={(event) => setUpload((current) => ({ ...current, caption: event.target.value }))} /></div>
          <div className="field"><label htmlFor="newCategory">Category</label><select id="newCategory" value={upload.category} onChange={(event) => setUpload((current) => ({ ...current, category: event.target.value }))}>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="field"><label htmlFor="newService">Related service</label><select id="newService" value={upload.serviceSlug} onChange={(event) => setUpload((current) => ({ ...current, serviceSlug: event.target.value }))}>{services.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        <div className="toggle-row"><label><input type="checkbox" checked={upload.featured} onChange={(event) => setUpload((current) => ({ ...current, featured: event.target.checked }))} /> Feature on homepage</label><label><input type="checkbox" checked={upload.published} onChange={(event) => setUpload((current) => ({ ...current, published: event.target.checked }))} /> Publish now</label></div>
        {message && <div className="admin-feedback">{message}</div>}
        <button className="button button-dark" type="submit" disabled={busy || !previews.length}>{busy ? "Uploading…" : "Upload photos"}</button>
      </form>
    </section>
    <section className="admin-section-heading"><div><h2>Gallery library</h2><p>{initialItems.length} active item{initialItems.length === 1 ? "" : "s"}</p></div></section>
    {initialItems.length ? <div className="admin-media-grid">{initialItems.map((item) => <GalleryItem key={item.id} item={item} router={router} />)}</div> : <div className="admin-empty">No gallery photos yet. Add the first authentic CutPro job photo above.</div>}
  </>;
}

function GalleryItem({ item, router }) {
  const [values, setValues] = useState({ altText: item.alt_text, caption: item.caption || "", category: item.category, serviceSlug: item.service_slug || "", featured: item.featured, published: item.published, sortOrder: item.sort_order, beforeAfterGroup: item.before_after_group || "", beforeAfterRole: item.before_after_role || "" });
  const [state, setState] = useState("idle");
  const save = async () => { setState("saving"); const response = await fetch(`/api/admin/gallery/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }); setState(response.ok ? "saved" : "error"); if (response.ok) router.refresh(); };
  const remove = async () => { if (!window.confirm("Remove this photo from the gallery? This also removes the stored image and cannot be undone.")) return; setState("saving"); const response = await fetch(`/api/admin/gallery/${item.id}`, { method: "DELETE" }); if (response.ok) router.refresh(); else setState("error"); };
  const change = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const fieldId = (field) => `gallery-${item.id}-${field}`;
  return <article className="admin-media-card">
    {/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.public_url} alt={item.alt_text} />
    <div className="admin-media-fields">
      <div className="field"><label htmlFor={fieldId("altText")}>Photo description</label><input id={fieldId("altText")} value={values.altText} onChange={(event) => change("altText", event.target.value)} /></div>
      <div className="field"><label htmlFor={fieldId("caption")}>Caption</label><input id={fieldId("caption")} value={values.caption} onChange={(event) => change("caption", event.target.value)} /></div>
      <div className="form-grid">
        <div className="field"><label htmlFor={fieldId("category")}>Category</label><select id={fieldId("category")} value={values.category} onChange={(event) => change("category", event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="field"><label htmlFor={fieldId("serviceSlug")}>Service</label><select id={fieldId("serviceSlug")} value={values.serviceSlug} onChange={(event) => change("serviceSlug", event.target.value)}>{services.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><label htmlFor={fieldId("sortOrder")}>Display order</label><input id={fieldId("sortOrder")} type="number" value={values.sortOrder} onChange={(event) => change("sortOrder", event.target.value)} /></div>
        <div className="field"><label htmlFor={fieldId("beforeAfterGroup")}>Pair name</label><input id={fieldId("beforeAfterGroup")} value={values.beforeAfterGroup} onChange={(event) => change("beforeAfterGroup", event.target.value)} placeholder="Example: Oak removal 1" /></div>
        <div className="field"><label htmlFor={fieldId("beforeAfterRole")}>Pair position</label><select id={fieldId("beforeAfterRole")} value={values.beforeAfterRole} onChange={(event) => change("beforeAfterRole", event.target.value)}><option value="">Not paired</option><option value="before">Before</option><option value="after">After</option></select></div>
      </div>
      <div className="toggle-row"><label><input type="checkbox" checked={values.featured} onChange={(event) => change("featured", event.target.checked)} /> Featured</label><label><input type="checkbox" checked={values.published} onChange={(event) => change("published", event.target.checked)} /> Published</label></div>
      <div className="admin-item-actions"><button className="button button-dark" type="button" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}</button><button className="button button-danger" type="button" onClick={remove}>Delete</button></div>
      {state === "error" && <span className="field-error">The change could not be completed.</span>}
    </div>
  </article>;
}

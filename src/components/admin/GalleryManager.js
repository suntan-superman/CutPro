"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useObjectUrls from "@/hooks/useObjectUrls";
import { createDirectUploadDraft, submitDirectUpload, validateDirectUploadFiles } from "@/lib/directUploadClient";

const categories = ["Tree Removal", "Tree Trimming", "Stump Grinding", "Emergency/Storm", "Equipment", "Before & After", "Other"];
const services = [["", "None"], ["tree-removal", "Tree Removal"], ["tree-trimming", "Tree Trimming"], ["stump-grinding", "Stump Grinding"], ["emergency-tree-service", "Emergency Tree Service"]];

export default function GalleryManager({ initialItems }) {
  const router = useRouter();
  const [previews, setPreviews] = useState([]);
  const [upload, setUpload] = useState({ altText: "", caption: "", category: "Other", serviceSlug: "", featured: false, published: false, teamPhoto: false });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const uploadDraft = useRef(null);
  const { createObjectUrl, clearObjectUrls } = useObjectUrls();
  const locked = busy || finalizing;

  const changeUpload = (key, value) => {
    uploadDraft.current = null;
    setUpload((current) => ({ ...current, [key]: value }));
    setMessage("");
  };

  const selectFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    const error = validateDirectUploadFiles(selected, { gallery: true });
    if (error) { setMessage(error); event.target.value = ""; return; }
    uploadDraft.current = null;
    setMessage("");
    clearObjectUrls();
    setPreviews(selected.map((file) => ({ file, url: createObjectUrl(file) })));
  };

  const uploadFiles = async (event) => {
    event.preventDefault(); if (!previews.length || busy) return; setBusy(true); setMessage("");
    const form = event.currentTarget;
    try {
      uploadDraft.current ||= createDirectUploadDraft({ kind: "gallery", files: previews.map(({ file }) => file), metadata: upload });
      const result = await submitDirectUpload(uploadDraft.current, { onProgress: setMessage, onFinalizing: () => setFinalizing(true) });
      setMessage(`${result.count} photo${result.count === 1 ? "" : "s"} added.`); clearObjectUrls(); setPreviews([]); setUpload({ altText: "", caption: "", category: "Other", serviceSlug: "", featured: false, published: false, teamPhoto: false }); uploadDraft.current = null; setFinalizing(false); form.reset(); router.refresh();
    }
    catch (error) {
      if (error.status === 410) { uploadDraft.current = null; setFinalizing(false); }
      setMessage(error.message || "Upload failed.");
    }
    finally { setBusy(false); }
  };

  return <>
    <section className="admin-card">
      <div className="admin-card-heading"><div><h2>Add project photos</h2><p>Upload JPG, PNG, or WebP images up to 8 MB each. Photos upload directly to secure storage and are checked and optimized before publication.</p></div></div>
      <form className="admin-form" onSubmit={uploadFiles} aria-busy={busy}>
        <div className="field"><label htmlFor="galleryFiles">Photos (up to 6)</label><input id="galleryFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple required={!previews.length} disabled={locked} onChange={selectFiles} /></div>
        {previews.length > 0 && <div className="admin-upload-previews">{previews.map((item) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={item.url} src={item.url} alt="Selected upload preview" />)}</div>}
        <div className="form-grid">
          <div className="field full"><label htmlFor="newAlt">Photo description <span>*</span></label><input id="newAlt" value={upload.altText} disabled={locked} onChange={(event) => changeUpload("altText", event.target.value)} required placeholder="Example: CutPro crew trimming a mature tree beside a Bakersfield home" /></div>
          <div className="field full"><label htmlFor="newCaption">Caption</label><input id="newCaption" value={upload.caption} disabled={locked} onChange={(event) => changeUpload("caption", event.target.value)} /></div>
          <div className="field"><label htmlFor="newCategory">Category</label><select id="newCategory" value={upload.category} disabled={locked} onChange={(event) => changeUpload("category", event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="field"><label htmlFor="newService">Related service</label><select id="newService" value={upload.serviceSlug} disabled={locked} onChange={(event) => changeUpload("serviceSlug", event.target.value)}>{services.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        <div className="toggle-row"><label><input type="checkbox" checked={upload.featured} disabled={locked} onChange={(event) => changeUpload("featured", event.target.checked)} /> Feature on homepage</label><label><input type="checkbox" checked={upload.published} disabled={locked} onChange={(event) => changeUpload("published", event.target.checked)} /> Publish now</label><label><input type="checkbox" checked={upload.teamPhoto} disabled={locked} onChange={(event) => changeUpload("teamPhoto", event.target.checked)} /> Use as team photo</label></div>
        {message && <div className="admin-feedback" role="status" aria-live="polite">{message}</div>}
        {finalizing && !busy && <p>Retry this upload to confirm whether it was saved. Its photos and details are kept unchanged to prevent duplicates.</p>}
        <button className="button button-dark" type="submit" disabled={busy || !previews.length}>{busy ? "Uploading…" : "Upload photos"}</button>
      </form>
    </section>
    <section className="admin-section-heading"><div><h2>Gallery library</h2><p>{initialItems.length} active item{initialItems.length === 1 ? "" : "s"}</p></div></section>
    {initialItems.length ? <div className="admin-media-grid">{initialItems.map((item) => <GalleryItem key={item.id} item={item} router={router} />)}</div> : <div className="admin-empty">No gallery photos yet. Add the first authentic CutPro job photo above.</div>}
  </>;
}

function GalleryItem({ item, router }) {
  const [values, setValues] = useState({ altText: item.alt_text, caption: item.caption || "", category: item.category, serviceSlug: item.service_slug || "", featured: item.featured, published: item.published, teamPhoto: item.team_photo, sortOrder: item.sort_order, beforeAfterGroup: item.before_after_group || "", beforeAfterRole: item.before_after_role || "" });
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
      <div className="toggle-row"><label><input type="checkbox" checked={values.featured} onChange={(event) => change("featured", event.target.checked)} /> Featured</label><label><input type="checkbox" checked={values.published} onChange={(event) => change("published", event.target.checked)} /> Published</label><label><input type="checkbox" checked={values.teamPhoto} onChange={(event) => change("teamPhoto", event.target.checked)} /> Team photo</label></div>
      <div className="admin-item-actions"><button className="button button-dark" type="button" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}</button><button className="button button-danger" type="button" onClick={remove}>Delete</button></div>
      {state === "error" && <span className="field-error">The change could not be completed.</span>}
    </div>
  </article>;
}

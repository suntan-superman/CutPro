"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { business } from "@/data/business";
import { estimateServiceOptions } from "@/data/services";
import { ArrowIcon, CheckIcon, PhoneIcon } from "@/components/ui/Icons";
import TurnstileWidget from "@/components/forms/TurnstileWidget";
import { trackEvent } from "@/lib/analytics";

const steps = ["Service", "Job", "Photos", "Contact", "Review"];
const urgencyOptions = ["Flexible", "Within a week", "As soon as possible", "Emergency"];
const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const maxFileSize = 8 * 1024 * 1024;
const maxFiles = 6;

const initialFields = {
  services: [], urgency: "", jobDescription: "", approximateCount: "", preferredTimeframe: "",
  firstName: "", lastName: "", phone: "", email: "", propertyAddress: "", city: "Bakersfield", zip: "",
  preferredContactMethod: "Phone", bestContactTime: "", customerNotes: "", website: "",
};

function FieldError({ message }) {
  return message ? <span className="field-error" role="alert">{message}</span> : null;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function EstimateForm() {
  const searchParams = useSearchParams();
  const requestedService = searchParams.get("service");
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState(() => ({
    ...initialFields,
    services: estimateServiceOptions.some((item) => item.value === requestedService)
      ? [requestedService]
      : [],
  }));
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [serverMessage, setServerMessage] = useState("");
  const [reference, setReference] = useState("");
  const [submissionToken] = useState(() => globalThis.crypto?.randomUUID?.() || "22222222-2222-4222-8222-222222222222");
  const [startedAt] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    trackEvent("estimate_start");
  }, []);

  const handleTurnstileToken = useCallback((token) => setTurnstileToken(token), []);

  useEffect(() => () => photos.forEach((photo) => photo.preview && URL.revokeObjectURL(photo.preview)), [photos]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const toggleService = (value) => {
    setFields((current) => ({
      ...current,
      services: current.services.includes(value) ? current.services.filter((item) => item !== value) : [...current.services, value],
    }));
    setErrors((current) => ({ ...current, services: undefined }));
  };

  const validateStep = useCallback((index) => {
    const nextErrors = {};
    if (index === 0 && !fields.services.length) nextErrors.services = "Choose at least one service.";
    if (index === 1) {
      if (fields.jobDescription.trim().length < 10) nextErrors.jobDescription = "Add a short description of the work.";
      if (!fields.urgency) nextErrors.urgency = "Choose an urgency.";
    }
    if (index === 3) {
      if (!fields.firstName.trim()) nextErrors.firstName = "Enter your first name.";
      if (fields.phone.replace(/\D/g, "").length < 10) nextErrors.phone = "Enter a valid phone number.";
      if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) nextErrors.email = "Enter a valid email address.";
      if (!fields.propertyAddress.trim()) nextErrors.propertyAddress = "Enter the property address.";
      if (!fields.city.trim()) nextErrors.city = "Enter the city.";
      if (!/^\d{5}(?:-\d{4})?$/.test(fields.zip)) nextErrors.zip = "Enter a valid ZIP code.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [fields]);

  const nextStep = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectPhotos = async (event) => {
    const selected = Array.from(event.target.files || []);
    const remaining = maxFiles - photos.length;
    const accepted = [];
    const rejected = [];
    for (const file of selected.slice(0, remaining)) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!acceptedTypes.includes(file.type) || !["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension)) rejected.push(`${file.name}: unsupported image type`);
      else if (file.size > maxFileSize) rejected.push(`${file.name}: larger than 8 MB`);
      else accepted.push({ file, preview: ["image/heic", "image/heif"].includes(file.type) ? null : URL.createObjectURL(file) });
    }
    if (selected.length > remaining) rejected.push(`Only ${maxFiles} photos can be added.`);
    setPhotos((current) => [...current, ...accepted]);
    setErrors((current) => ({ ...current, photos: rejected.join(" ") || undefined }));
    event.target.value = "";
  };

  const removePhoto = (index) => {
    setPhotos((current) => {
      const removed = current[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const submit = async () => {
    if (!submissionToken || status === "submitting") return;
    setStatus("submitting");
    setServerMessage(photos.length ? `Uploading ${photos.length} photo${photos.length === 1 ? "" : "s"} and saving your request…` : "Saving your request…");
    const payload = { ...fields, submissionToken, startedAt, turnstileToken };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    photos.forEach(({ file }) => formData.append("photos", file, file.name));
    try {
      const response = await fetch("/api/estimate", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) {
        setErrors(result.errors || {});
        throw new Error(result.message || "Your request could not be submitted.");
      }
      setReference(result.reference);
      setServerMessage(result.photoWarning ? "Your request was saved, but one or more photos could not be attached. CutPro can still follow up with you." : "Your request and available photos were saved.");
      setStatus("success");
      trackEvent("estimate_submit", { lead_reference: result.reference });
    } catch (error) {
      setStatus("error");
      setServerMessage(error.message || "Something went wrong. Please try again or call CutPro.");
    }
  };

  const serviceLabels = useMemo(() => fields.services.map((value) => estimateServiceOptions.find((item) => item.value === value)?.label).filter(Boolean), [fields.services]);

  if (status === "success") {
    return <div className="form-success" role="status"><div className="success-mark"><CheckIcon className="size-9" /></div><p className="eyebrow">Request received</p><h2>Thank you, {fields.firstName}.</h2><p>{serverMessage}</p><div className="reference-card"><span>Your reference</span><strong>{reference}</strong></div><p>Save this reference if you need to call about the request. No appointment or response time is confirmed until CutPro contacts you.</p><div className="inline-actions"><a href={business.phoneHref} className="button button-dark" data-phone-cta><PhoneIcon className="size-5" /> Call {business.phoneDisplay}</a><Link href="/" className="button button-outline">Return home</Link></div></div>;
  }

  return (
    <div className="estimate-app">
      <nav className="step-nav" aria-label="Estimate request progress">
        {steps.map((label, index) => <button type="button" key={label} className={index === step ? "active" : index < step ? "complete" : ""} aria-current={index === step ? "step" : undefined} onClick={() => index < step && setStep(index)}><span>{index < step ? <CheckIcon className="size-4" /> : index + 1}</span><small>{label}</small></button>)}
      </nav>
      <div className="estimate-panel">
        {step === 0 && <section><p className="eyebrow">Step 1 of 5</p><h2>What can we help with?</h2><p>Select every service that may apply. You can explain the details on the next screen.</p><div className="choice-grid">{estimateServiceOptions.map((option) => <label key={option.value} className={fields.services.includes(option.value) ? "selected" : ""}><input type="checkbox" checked={fields.services.includes(option.value)} onChange={() => toggleService(option.value)} /><span className="choice-check"><CheckIcon className="size-5" /></span><strong>{option.label}</strong></label>)}</div><FieldError message={errors.services} /></section>}
        {step === 1 && <section><p className="eyebrow">Step 2 of 5</p><h2>Tell us about the job.</h2><div className="field"><label htmlFor="jobDescription">What do you need done? <span>*</span></label><textarea id="jobDescription" name="jobDescription" rows="6" value={fields.jobDescription} onChange={updateField} placeholder="For example: One large tree has limbs over the roof and driveway…" maxLength="2000" aria-invalid={Boolean(errors.jobDescription)} /><FieldError message={errors.jobDescription} /></div><fieldset><legend>How urgent is it? <span>*</span></legend><div className="radio-grid">{urgencyOptions.map((option) => <label key={option} className={fields.urgency === option ? "selected" : ""}><input type="radio" name="urgency" value={option} checked={fields.urgency === option} onChange={updateField} />{option}</label>)}</div><FieldError message={errors.urgency} /></fieldset><div className="form-grid"><div className="field"><label htmlFor="approximateCount">Approximate number of trees/stumps</label><input id="approximateCount" name="approximateCount" value={fields.approximateCount} onChange={updateField} placeholder="Example: 2 trees" maxLength="50" /></div><div className="field"><label htmlFor="preferredTimeframe">Preferred timeframe</label><input id="preferredTimeframe" name="preferredTimeframe" value={fields.preferredTimeframe} onChange={updateField} placeholder="Example: This month" maxLength="100" /></div></div></section>}
        {step === 2 && <section><p className="eyebrow">Step 3 of 5</p><h2>Add photos from the property.</h2><p>Optional, but useful. Include a wide view of the tree or stump and closer views of the concern. Do not approach unsafe areas or utility lines.</p><label className="upload-drop"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" multiple onChange={selectPhotos} disabled={photos.length >= maxFiles} /><span className="upload-icon">＋</span><strong>{photos.length >= maxFiles ? "Photo limit reached" : "Choose photos"}</strong><small>JPG, PNG, WebP, HEIC or HEIF · up to 8 MB each · {maxFiles} total</small></label><FieldError message={errors.photos} />{photos.length > 0 && <div className="photo-preview-grid">{photos.map((photo, index) => <div className="photo-preview" key={`${photo.file.name}-${index}`}>{photo.preview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo.preview} alt={`Preview of ${photo.file.name}`} /> : <div className="heic-preview">HEIC</div>}<div><span title={photo.file.name}>{photo.file.name}</span><small>{formatBytes(photo.file.size)}</small></div><button type="button" onClick={() => removePhoto(index)} aria-label={`Remove ${photo.file.name}`}>Remove</button></div>)}</div>}</section>}
        {step === 3 && <section><p className="eyebrow">Step 4 of 5</p><h2>Where is the work?</h2><div className="form-grid"><div className="field"><label htmlFor="firstName">First name <span>*</span></label><input id="firstName" name="firstName" autoComplete="given-name" value={fields.firstName} onChange={updateField} aria-invalid={Boolean(errors.firstName)} /><FieldError message={errors.firstName} /></div><div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" autoComplete="family-name" value={fields.lastName} onChange={updateField} /></div><div className="field"><label htmlFor="phone">Phone <span>*</span></label><input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={fields.phone} onChange={updateField} aria-invalid={Boolean(errors.phone)} /><FieldError message={errors.phone} /></div><div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" value={fields.email} onChange={updateField} aria-invalid={Boolean(errors.email)} /><FieldError message={errors.email} /></div><div className="field full"><label htmlFor="propertyAddress">Property address <span>*</span></label><input id="propertyAddress" name="propertyAddress" autoComplete="street-address" value={fields.propertyAddress} onChange={updateField} aria-invalid={Boolean(errors.propertyAddress)} /><FieldError message={errors.propertyAddress} /></div><div className="field"><label htmlFor="city">City <span>*</span></label><input id="city" name="city" autoComplete="address-level2" value={fields.city} onChange={updateField} aria-invalid={Boolean(errors.city)} /><FieldError message={errors.city} /></div><div className="field"><label htmlFor="zip">ZIP code <span>*</span></label><input id="zip" name="zip" autoComplete="postal-code" inputMode="numeric" value={fields.zip} onChange={updateField} aria-invalid={Boolean(errors.zip)} /><FieldError message={errors.zip} /></div><div className="field"><label htmlFor="preferredContactMethod">Preferred contact method</label><select id="preferredContactMethod" name="preferredContactMethod" value={fields.preferredContactMethod} onChange={updateField}><option>Phone</option><option>Text</option><option>Email</option></select></div><div className="field"><label htmlFor="bestContactTime">Best time to contact</label><input id="bestContactTime" name="bestContactTime" value={fields.bestContactTime} onChange={updateField} placeholder="Example: Weekdays after 3" /></div><div className="field full"><label htmlFor="customerNotes">Anything else CutPro should know?</label><textarea id="customerNotes" name="customerNotes" rows="4" value={fields.customerNotes} onChange={updateField} maxLength="1000" /></div></div><div className="honey-field" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex="-1" autoComplete="off" value={fields.website} onChange={updateField} /></div></section>}
        {step === 4 && <section><p className="eyebrow">Step 5 of 5</p><h2>Review your request.</h2><div className="review-list"><div><span>Service</span><strong>{serviceLabels.join(", ")}</strong><button type="button" onClick={() => setStep(0)}>Edit</button></div><div><span>Job</span><strong>{fields.urgency}</strong><p>{fields.jobDescription}</p><button type="button" onClick={() => setStep(1)}>Edit</button></div><div><span>Photos</span><strong>{photos.length ? `${photos.length} selected` : "No photos added"}</strong><button type="button" onClick={() => setStep(2)}>Edit</button></div><div><span>Contact & property</span><strong>{fields.firstName} {fields.lastName}</strong><p>{fields.phone}{fields.email ? ` · ${fields.email}` : ""}<br />{fields.propertyAddress}, {fields.city}, {fields.zip}<br />Prefers {fields.preferredContactMethod}{fields.bestContactTime ? ` · ${fields.bestContactTime}` : ""}</p><button type="button" onClick={() => setStep(3)}>Edit</button></div></div><div className="consent-copy">By submitting, you ask CutPro to contact you about this service request using the details above. This does not confirm a price or appointment. See the <Link href="/privacy" target="_blank">Privacy Policy</Link>.</div><TurnstileWidget onToken={handleTurnstileToken} />{status === "error" && <div className="form-alert error" role="alert">{serverMessage}</div>}{Object.keys(errors).length > 0 && <div className="form-alert error" role="alert">Review the highlighted information before submitting.</div>}</section>}
        <div className="form-navigation">{step > 0 && <button className="button button-outline" type="button" onClick={() => setStep((current) => current - 1)} disabled={status === "submitting"}>Back</button>}<span>Step {step + 1} of {steps.length}</span>{step < 4 ? <button className="button button-dark" type="button" onClick={nextStep}>Continue <ArrowIcon className="size-5" /></button> : <button className="button button-primary" type="button" onClick={submit} disabled={status === "submitting"}>{status === "submitting" ? serverMessage : "Send my request"}</button>}</div>
      </div>
    </div>
  );
}

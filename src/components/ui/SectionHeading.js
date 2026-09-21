export default function SectionHeading({ eyebrow, title, copy, align = "left" }) {
  return (
    <div className={`section-heading ${align === "center" ? "text-center mx-auto" : ""}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {copy && <p className="section-copy">{copy}</p>}
    </div>
  );
}


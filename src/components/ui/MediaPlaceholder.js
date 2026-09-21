export default function MediaPlaceholder({ label = "Authentic CutPro project photo", className = "", compact = false }) {
  return (
    <div className={`media-placeholder ${compact ? "media-placeholder-compact" : ""} ${className}`} role="img" aria-label={`${label} placeholder`}>
      <div className="placeholder-sun" />
      <div className="placeholder-ridge ridge-back" />
      <div className="placeholder-ridge ridge-front" />
      <div className="placeholder-tree tree-one" />
      <div className="placeholder-tree tree-two" />
      <span>{label}</span>
    </div>
  );
}


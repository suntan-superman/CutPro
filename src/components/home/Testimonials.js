export default function Testimonials({ items }) {
  if (!items.length) return null;
  return (
    <section className="section section-cream" aria-labelledby="reviews-title">
      <div className="shell">
        <div className="section-heading">
          <p className="eyebrow">Customer feedback</p>
          <h2 id="reviews-title">What customers say</h2>
        </div>
        <div className="testimonial-grid">
          {items.map((item) => (
            <figure className="testimonial-card" key={item.id}>
              {item.rating && <div className="stars" aria-label={`${item.rating} out of 5 stars`}>{"★".repeat(item.rating)}</div>}
              <blockquote>“{item.testimonial_text}”</blockquote>
              <figcaption>
                <strong>{item.customer_name}</strong>
                {item.source_url ? <a href={item.source_url} rel="noopener noreferrer" target="_blank">View on {item.source}</a> : <span>{item.source}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}


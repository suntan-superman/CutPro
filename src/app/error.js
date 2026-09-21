"use client";

export default function ErrorPage({ reset }) {
  return <section className="empty-page"><p className="eyebrow">Something went wrong</p><h1>We couldn&apos;t load this page.</h1><p>Try again, or call CutPro if you need to reach the team now.</p><button className="button button-dark" type="button" onClick={reset}>Try again</button></section>;
}


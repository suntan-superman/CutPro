import Link from "next/link";

export default function NotFound() {
  return <section className="empty-page"><p className="eyebrow">404</p><h1>That page isn&apos;t here.</h1><p>Return to the CutPro homepage or start an estimate request.</p><div className="inline-actions"><Link href="/" className="button button-outline">Go home</Link><Link href="/free-estimate" className="button button-primary">Free estimate</Link></div></section>;
}


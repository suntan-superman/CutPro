export function ArrowIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PhoneIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.3 3.5 10 7.9 7.9 10a15.5 15.5 0 0 0 6.1 6.1l2.1-2.1 4.4 2.7c.3.2.5.6.4 1A4 4 0 0 1 17 21C9.3 21 3 14.7 3 7a4 4 0 0 1 3.3-3.9c.4-.1.8.1 1 .4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuIcon({ open = false }) {
  return (
    <svg className="size-6" viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function CheckIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TreeMark({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 52 52" aria-hidden="true">
      <path d="M26 4c-3 6-8 8-11 13-2 3-2 7 0 10-5 1-8 4-8 9 0 6 5 10 12 10h14c7 0 12-4 12-10 0-5-3-8-8-9 2-3 2-7 0-10C34 12 29 10 26 4Z" fill="currentColor" />
      <path d="M26 22v26m0-14-7-6m7 12 8-7" fill="none" stroke="#f2f0e8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

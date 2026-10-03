"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Outlook = {
  label: string;
  title: string;
  emphasis: string;
  paragraphs: readonly string[];
  action: string;
};

// An editorial epilogue, deliberately outside the tunnel's scene clock.
export default function FutureNote({ content, arabic, children }: {
  content: Outlook;
  arabic: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = root.current;
    if (!section) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        section.dataset.revealed = "true";
        observer.disconnect();
      }
    }, { threshold: .18 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={root} id="outlook" className="future-note" dir={arabic ? "rtl" : "ltr"} aria-labelledby="outlook-title">
      <div className="future-note-light" aria-hidden="true" />
      <div className="future-note-content">
        <p className="future-note-label">{content.label}</p>
        <h2 id="outlook-title">{content.title}{" "}<span>{content.emphasis}</span></h2>
        <div className="future-note-prose">
          {content.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        <a className="future-note-link" href="#contact">
          <span>{content.action}</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </a>
      </div>
      {children}
    </section>
  );
}

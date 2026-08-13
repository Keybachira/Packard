import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function Panel({ title, children, className = "" }: Props) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-4 ${className}`}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-dim">{title}</h2>
      {children}
    </section>
  );
}
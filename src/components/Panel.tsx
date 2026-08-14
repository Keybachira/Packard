import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export default function Panel({
  title,
  children,
  className = "",
  action,
}: Props) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <span className="eyebrow">{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

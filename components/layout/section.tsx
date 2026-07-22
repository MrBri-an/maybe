import type { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  id: string;
};

export function Section({ children, eyebrow, title, description, id }: SectionProps) {
  return (
    <section className="section" aria-labelledby={id}>
      <header className="section-header">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 id={id}>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

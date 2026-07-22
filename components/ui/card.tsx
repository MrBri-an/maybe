import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  tone?: "midnight" | "cream" | "rose";
};

export function Card({ children, className = "", tone = "midnight", ...props }: CardProps) {
  return (
    <article className={`card card-${tone} ${className}`.trim()} {...props}>
      {children}
    </article>
  );
}

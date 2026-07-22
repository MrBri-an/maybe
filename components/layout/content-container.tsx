import type { ReactNode } from "react";

type ContentContainerProps = {
  children: ReactNode;
  size?: "reading" | "default" | "wide";
};

export function ContentContainer({ children, size = "default" }: ContentContainerProps) {
  return <div className={`content-container content-container-${size}`}>{children}</div>;
}

import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="ambient-light ambient-light-rose" aria-hidden="true" />
      <div className="ambient-light ambient-light-lavender" aria-hidden="true" />
      {children}
    </div>
  );
}

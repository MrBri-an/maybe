"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { completeLibraryJourney } from "@/app/library/progression-actions";

export function RoomCompletionPanel({ title, message, primary, secondaryHref = "/?view=world", children }: {
  title: string;
  message: string;
  primary: ReactNode;
  secondaryHref?: string;
  children?: ReactNode;
}) {
  return (
    <section className="room-completion-panel">
      <span aria-hidden="true">✦</span>
      <div><h2>{title}</h2><p>{message}</p>{children}<div className="room-completion-actions">{primary}<Link href={secondaryHref}>Return to World</Link></div></div>
    </section>
  );
}

export function LibraryJourneyPanel() {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const continueJourney = () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setError(null);
    startTransition(async () => {
      const result = await completeLibraryJourney();
      if (result.ok) {
        router.push("/?view=world");
        router.refresh();
        return;
      }
      pendingRef.current = false;
      setError(result.error ?? "The next step could not be saved. Please try again.");
    });
  };

  return (
    <RoomCompletionPanel
      title="Ready to continue?"
      message="This room will always be here for books, stories and quiet discoveries. You do not need to add or read anything before continuing."
      primary={<button type="button" onClick={continueJourney} disabled={pending} aria-busy={pending}>{pending ? "Continuing…" : "Continue the journey"}</button>}
    >
      {error ? <p role="alert">{error}</p> : null}
    </RoomCompletionPanel>
  );
}

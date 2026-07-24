"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

export function LibraryJourneyPanel({ alreadyCompleted }: { alreadyCompleted: boolean }) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
  }, []);

  if (alreadyCompleted) {
    return (
      <RoomCompletionPanel
        title="The next destination is open"
        message="The Library is complete. The Puzzle Room is ready whenever you want to continue."
        primary={<Link href="/puzzles" prefetch>Continue the journey</Link>}
      />
    );
  }

  const continueJourney = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await completeLibraryJourney();
      if (result.ok) {
        router.replace("/puzzles");
        fallbackTimer.current = setTimeout(() => {
          if (window.location.pathname === "/library") window.location.assign("/puzzles");
        }, 1500);
        return;
      }
      setError(result.error ?? "The next step could not be saved. Please try again.");
    } catch {
      setError("The next step could not be saved. Please try again.");
    } finally {
      if (!fallbackTimer.current) {
        pendingRef.current = false;
        setPending(false);
      }
    }
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

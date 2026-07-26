"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { JourneyProgressMenu } from "@/features/progression/journey-progress-menu";
import { CornerChat } from "@/features/our-corner/corner-chat";
import { RoomCompletionPanel } from "@/features/progression/room-completion-panel";
import { completeOurCornerJourney, recordOurCornerNextDestination } from "@/app/our-corner/actions";
import { CornerMoodControl } from "@/features/our-corner/corner-features";

type RoomTheme = "neutral" | "day" | "night";

function localTheme(): Exclude<RoomTheme, "neutral"> {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

function millisecondsToBoundary() {
  const now = new Date();
  const boundary = new Date(now);
  if (now.getHours() < 6) boundary.setHours(6, 0, 0, 0);
  else if (now.getHours() < 18) boundary.setHours(18, 0, 0, 0);
  else {
    boundary.setDate(boundary.getDate() + 1);
    boundary.setHours(6, 0, 0, 0);
  }
  return Math.max(1000, boundary.getTime() - now.getTime());
}

export function OurCornerExperience({ ourCornerCompleted: initiallyCompleted }: { ourCornerCompleted: boolean }) {
  const router = useRouter();
  const [theme, setTheme] = useState<RoomTheme>("neutral");
  const [visible, setVisible] = useState(true);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const completionLock = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleTheme = () => {
      setTheme(localTheme());
      if (boundaryTimer) clearTimeout(boundaryTimer);
      boundaryTimer = setTimeout(scheduleTheme, millisecondsToBoundary() + 250);
    };
    const updateVisibility = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      if (isVisible) scheduleTheme();
    };
    scheduleTheme();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      if (boundaryTimer) clearTimeout(boundaryTimer);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const continueJourney = async () => {
    if (completionLock.current) return;
    completionLock.current = true;
    setCompletionPending(true);
    setCompletionError("");
    try {
      const result = await completeOurCornerJourney();
      if (!result.ok) {
        setCompletionError(result.error);
        return;
      }
      setCompleted(true);
      void recordOurCornerNextDestination();
      router.replace("/?view=world");
      fallbackTimer.current = setTimeout(() => {
        if (window.location.pathname === "/our-corner") window.location.assign("/?view=world");
      }, 1500);
    } catch {
      setCompletionError("The next step could not be saved. Please try again.");
    } finally {
      if (!fallbackTimer.current) {
        completionLock.current = false;
        setCompletionPending(false);
      }
    }
  };

  return (
    <main className={`our-corner-shell is-${theme} ${visible ? "" : "is-paused"}`}>
      <div className="our-corner-sky" aria-hidden="true">
        <span className="corner-celestial-anchor"><i className="corner-celestial-body" /></span>
        <span className="corner-stars">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--corner-index": index } as CSSProperties} />)}</span>
      </div>
      <div className="our-corner-room" aria-labelledby="our-corner-title">
        <header className="our-corner-chat-header">
          <Link href="/?view=world">Return to World</Link>
          <div>
          <p>World nine · a room for two</p>
          <h1 id="our-corner-title">Our Corner</h1>
          <blockquote>A quiet place for the conversations that belong only to us.</blockquote>
          </div>
          <CornerMoodControl />
          <button type="button" className="corner-completion-trigger" onClick={() => setCompletionOpen(true)}>Complete journey</button>
          <JourneyProgressMenu storybookCompleted libraryCompleted puzzleRoomCompleted radioCompleted questionGardenCompleted galleryCompleted herUniverseCompleted maybeDaysCompleted ourCornerCompleted={completed} />
        </header>
        <div className="corner-window" aria-hidden="true"><i className="corner-curtain is-left" /><i className="corner-curtain is-right" /><span /></div>
        <span className="corner-plant is-left" aria-hidden="true"><i /><i /><i /></span>
        <span className="corner-plant is-right" aria-hidden="true"><i /><i /><i /></span>
        <span className="corner-flowers" aria-hidden="true"><i /><i /><i /></span>
        <div className="corner-couch" aria-hidden="true"><i /><span /><span /></div>
        <CornerChat />
        <div className="corner-particles" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} style={{ "--corner-index": index } as CSSProperties} />)}</div>
      </div>
      {completionOpen ? <div className="our-corner-completion">
        <RoomCompletionPanel
          title="This corner will always remain open"
          message="Every conversation, quiet moment and shared thought can continue waiting here whenever you return."
          primary={completed
            ? <Link href="/?view=world" prefetch>Continue the journey</Link>
            : <button type="button" disabled={completionPending} aria-busy={completionPending} onClick={() => void continueJourney()}>{completionPending ? "Continuing…" : "Continue the journey"}</button>}
          secondary={<button type="button" onClick={() => setCompletionOpen(false)}>Return to Our Corner</button>}
        >{completionError ? <p role="alert">{completionError}</p> : null}</RoomCompletionPanel>
      </div> : null}
    </main>
  );
}

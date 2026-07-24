"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { JOURNEY_ROOMS, getJourneyRoomState, getJourneySummary, type JourneyRoomState } from "@/lib/progression/rooms";

export function JourneyProgressMenu({ storybookCompleted, libraryCompleted, puzzleRoomCompleted = false, radioCompleted = false, questionGardenCompleted = false }: { storybookCompleted: boolean; libraryCompleted: boolean; puzzleRoomCompleted?: boolean; radioCompleted?: boolean; questionGardenCompleted?: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const summary = getJourneySummary(storybookCompleted, libraryCompleted, puzzleRoomCompleted, radioCompleted, questionGardenCompleted);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), [tabindex]:not([tabindex='-1'])");
      if (!focusable?.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="journey-menu">
      <button ref={triggerRef} type="button" aria-expanded={open} aria-haspopup="dialog" aria-controls="journey-progress-dialog" onClick={() => setOpen((current) => !current)}>Journey progress</button>
      {open && typeof document !== "undefined" ? createPortal(<div className="journey-menu-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div ref={dialogRef} id="journey-progress-dialog" className="journey-menu-popover" role="dialog" aria-modal="true" aria-label="Journey progress" tabIndex={-1}>
        <header><strong>{summary.message}</strong>{summary.completed > 0 ? <span>{summary.completed} completed</span> : null}</header>
        <ol>
          {JOURNEY_ROOMS.map((room) => {
            const state = getJourneyRoomState(room.slug, storybookCompleted, libraryCompleted, puzzleRoomCompleted, radioCompleted, questionGardenCompleted);
            const displayState = state === "current" ? "available" : state;
            const href = room.slug === "storybook" ? "/story" : room.slug === "library" && storybookCompleted ? "/library" : room.slug === "puzzle-room" && libraryCompleted ? "/puzzles" : room.slug === "jessicas-radio" && puzzleRoomCompleted ? "/radio" : room.slug === "question-garden" && radioCompleted ? "/question-garden" : undefined;
            const description = room.slug === "storybook"
              ? "The story of the screenshot that started everything."
              : room.slug === "library"
                ? "A private reading room for books, stories and quiet discoveries."
                : room.slug === "puzzle-room" && libraryCompleted
                  ? puzzleRoomCompleted ? "The clues remain here whenever you feel like returning." : "A playful room of clues and small discoveries."
                  : room.slug === "jessicas-radio" && puzzleRoomCompleted
                    ? radioCompleted ? "The music library remains open whenever you want to return." : "A private shared music library for favourite songs and discoveries."
                  : room.slug === "question-garden" && radioCompleted
                    ? "A private garden of thoughtful questions, always optional."
                  : room.slug === "gallery" && questionGardenCompleted
                    ? "A shared gallery of photographs and memories is being prepared."
                  : "This destination will open later as the world continues to grow.";
            return <JourneyEntry key={room.slug} title={room.name} state={displayState} description={description} href={href} onSelect={() => setOpen(false)} />;
          })}
        </ol>
        </div>
      </div>, document.body) : null}
    </div>
  );
}

function JourneyEntry({ title, state, description, href, onSelect }: { title: string; state: JourneyRoomState; description: string; href?: string; onSelect: () => void }) {
  const label = state === "next" ? "Next destination" : state === "later" ? "Coming later" : `${state.slice(0, 1).toUpperCase()}${state.slice(1)}`;
  const content = <><i aria-hidden="true">{state === "completed" ? "✓" : "✦"}</i><span><strong>{title}</strong><small>{label}</small><p>{description}</p></span></>;
  return <li className={`is-${state}`}>{href ? <Link href={href} onClick={onSelect}>{content}</Link> : <div>{content}</div>}</li>;
}

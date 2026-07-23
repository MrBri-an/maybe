"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { JOURNEY_ROOMS, getJourneyRoomState, getJourneySummary, type JourneyRoomState } from "@/lib/progression/rooms";

export function JourneyProgressMenu({ storybookCompleted, libraryCompleted, puzzleRoomCompleted = false }: { storybookCompleted: boolean; libraryCompleted: boolean; puzzleRoomCompleted?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const summary = getJourneySummary(storybookCompleted, libraryCompleted, puzzleRoomCompleted);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div className="journey-menu" ref={rootRef}>
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)}>Journey progress</button>
      {open ? <div className="journey-menu-popover" role="dialog" aria-label="Journey progress">
        <header><strong>{summary.message}</strong>{summary.completed > 0 ? <span>{summary.completed} completed</span> : null}</header>
        <ol>
          {JOURNEY_ROOMS.map((room) => {
            const state = getJourneyRoomState(room.slug, storybookCompleted, libraryCompleted, puzzleRoomCompleted);
            const displayState = state === "current" ? "available" : state;
            const href = room.slug === "storybook" ? "/story" : room.slug === "library" && storybookCompleted ? "/library" : room.slug === "puzzle-room" && libraryCompleted ? "/puzzles" : undefined;
            const description = room.slug === "storybook"
              ? "The story of the screenshot that started everything."
              : room.slug === "library"
                ? "A private reading room for books, stories and quiet discoveries."
                : room.slug === "puzzle-room" && libraryCompleted
                  ? puzzleRoomCompleted ? "The clues remain here whenever you feel like returning." : "A playful room of clues and small discoveries."
                  : room.slug === "jessicas-radio" && puzzleRoomCompleted
                    ? "A listening room is being prepared. It will open when the next part of this world is ready."
                  : "This destination will open later as the world continues to grow.";
            return <JourneyEntry key={room.slug} title={room.name} state={displayState} description={description} href={href} />;
          })}
        </ol>
      </div> : null}
    </div>
  );
}

function JourneyEntry({ title, state, description, href }: { title: string; state: JourneyRoomState; description: string; href?: string }) {
  const label = state === "next" ? "Next destination" : state === "later" ? "Coming later" : `${state.slice(0, 1).toUpperCase()}${state.slice(1)}`;
  const content = <><i aria-hidden="true">{state === "completed" ? "✓" : "✦"}</i><span><strong>{title}</strong><small>{label}</small><p>{description}</p></span></>;
  return <li className={`is-${state}`}>{href ? <Link href={href}>{content}</Link> : <div>{content}</div>}</li>;
}

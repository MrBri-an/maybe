"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const openingScenes = [
  {
    number: "01",
    eyebrow: "An ordinary moment",
    title: "Brian was working.",
    body: "Work was still in progress. Brian had not finished for the day.",
    visual: "desk",
  },
  {
    number: "02",
    eyebrow: "Then, a profile",
    title: "Jessica appeared on Snapchat.",
    body: "This is an original, playful reconstruction—not a copy of Snapchat or a real message screen.",
    visual: "profile",
  },
  {
    number: "03",
    eyebrow: "A practical idea",
    title: "A screenshot, for later.",
    body: "Brian took one so he could message after work.",
    visual: "flash",
  },
  {
    number: "04",
    eyebrow: "Immediately exposed",
    title: "Snapchat notified Jessica.",
    body: "The screenshot did not stay quiet. The app sent its notification before work was finished.",
    visual: "notice",
  },
  {
    number: "05",
    eyebrow: "So, an explanation",
    title: "Brian explained himself.",
    body: "No invented dialogue lives here—only the fact that an explanation followed.",
    visual: "explain",
  },
  {
    number: "06",
    eyebrow: "And then",
    title: "They continued talking.",
    body: "The conversation carried on beyond that unexpected screenshot notification.",
    visual: "connection",
  },
  {
    number: "07",
    eyebrow: "A small beginning",
    title: "The Beginning of Maybe.",
    body: "An ordinary working day became a moment worth remembering—without rushing what comes next.",
    visual: "maybe",
  },
] as const;

const rooms = [
  { name: "Storybook", note: "Pages from the beginning", position: "north" },
  { name: "Library", note: "A quiet reading room", position: "north-east" },
  { name: "Puzzle Room", note: "Small, forgiving curiosities", position: "east" },
  { name: "Jessica’s Radio", note: "Songs chosen with care", position: "south-east" },
  { name: "Question Garden", note: "Thoughtful questions, always optional", position: "south" },
  { name: "Gallery", note: "A few meaningful moments", position: "south-west" },
  { name: "Our Journey", note: "Only the milestones that truly happen", position: "west" },
  { name: "Maybe Days", note: "Gentle ideas for time together", position: "north-west" },
  { name: "Our Corner", note: "A calm private conversation space", position: "inner-left" },
  { name: "Open When", note: "Letters for another phase", position: "inner-right" },
] as const;

type WorldExperienceProps = {
  logoutAction: () => Promise<void>;
};

function SceneVisual({ visual }: { visual: (typeof openingScenes)[number]["visual"] }) {
  return (
    <div className={`scene-visual scene-visual-${visual}`} aria-hidden="true">
      <div className="scene-orbit" />
      <div className="scene-object">
        {visual === "desk" ? <><span /><span /><span /></> : null}
        {visual === "profile" ? <><strong>J</strong><span /></> : null}
        {visual === "flash" ? <><span className="flash-frame" /><strong>✦</strong></> : null}
        {visual === "notice" ? <><span className="notice-dot" /><span className="notice-line" /><span className="notice-line notice-line-short" /></> : null}
        {visual === "explain" ? <><span className="message-line message-line-one" /><span className="message-line message-line-two" /><span className="message-line message-line-three" /></> : null}
        {visual === "connection" ? <><span className="connection-point connection-one" /><span className="connection-thread" /><span className="connection-point connection-two" /></> : null}
        {visual === "maybe" ? <><span className="maybe-star">✦</span><span className="maybe-ring" /></> : null}
      </div>
    </div>
  );
}

export function WorldExperience({ logoutAction }: WorldExperienceProps) {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<"opening" | "map">("opening");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState(0);
  const scene = openingScenes[sceneIndex];
  const selected = rooms[selectedRoom];

  const showMap = () => setView("map");
  const replay = () => {
    setSceneIndex(0);
    setView("opening");
  };
  const continueOpening = () => {
    if (sceneIndex === openingScenes.length - 1) {
      showMap();
      return;
    }
    setSceneIndex((current) => current + 1);
  };

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.48, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="world-experience">
      <header className="world-toolbar">
        <div className="world-wordmark">
          <span aria-hidden="true">✦</span>
          <p>The Beginning of Maybe</p>
        </div>
        <div className="world-toolbar-actions">
          {view === "opening" ? (
            <Button type="button" variant="quiet" size="small" onClick={showMap}>Skip opening</Button>
          ) : (
            <Button type="button" variant="quiet" size="small" onClick={replay}>Replay opening</Button>
          )}
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" size="small">Log out</Button>
          </form>
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {view === "opening" ? (
          <motion.main
            className="opening-stage"
            key={`opening-${sceneIndex}`}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={transition}
          >
            <div className="opening-progress" aria-label={`Scene ${sceneIndex + 1} of ${openingScenes.length}`}>
              <span>{scene.number}</span>
              <div className="opening-progress-track" aria-hidden="true">
                <span style={{ "--opening-progress": `${((sceneIndex + 1) / openingScenes.length) * 100}%` } as CSSProperties} />
              </div>
              <span>{String(openingScenes.length).padStart(2, "0")}</span>
            </div>

            <section className="opening-scene" aria-live="polite" aria-labelledby="opening-title">
              <div className="opening-copy">
                <Badge tone="rose">Playful reconstruction</Badge>
                <p className="opening-eyebrow">{scene.eyebrow}</p>
                <h1 id="opening-title">{scene.title}</h1>
                <p>{scene.body}</p>
                <div className="opening-controls">
                  <Button type="button" onClick={continueOpening}>
                    {sceneIndex === openingScenes.length - 1 ? "Enter the world" : "Continue"}
                  </Button>
                  <p>{reduceMotion ? "Reduced motion is active." : "Motion follows your device preference."}</p>
                </div>
              </div>
              <SceneVisual visual={scene.visual} />
            </section>
          </motion.main>
        ) : (
          <motion.main
            className="world-map-view"
            key="world-map"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <header className="map-header">
              <Badge tone="gold">Your private world</Badge>
              <h1>A map of what may come next.</h1>
              <p>
                Every room is still locked. Explore the markers for a small preview;
                no destination or feature has been created yet.
              </p>
            </header>

            <section className="constellation-map" aria-label="Future rooms map">
              <div className="map-paths" aria-hidden="true"><span /><span /><span /></div>
              <div className="map-centre" aria-hidden="true">
                <span>✦</span>
                <p>Maybe</p>
              </div>
              {rooms.map((room, index) => (
                <button
                  className={`room-marker room-${room.position}`}
                  type="button"
                  key={room.name}
                  onClick={() => setSelectedRoom(index)}
                  aria-pressed={selectedRoom === index}
                  aria-label={`${room.name}, locked, coming later`}
                >
                  <span className="room-marker-dot" aria-hidden="true" />
                  <span className="room-marker-copy">
                    <strong>{room.name}</strong>
                    <small>Locked · Coming later</small>
                  </span>
                </button>
              ))}
            </section>

            <aside className="room-detail" aria-live="polite" aria-label="Selected future room">
              <div>
                <Badge>Locked · Coming later</Badge>
                <h2>{selected.name}</h2>
                <p>{selected.note}</p>
              </div>
              <span aria-hidden="true">{String(selectedRoom + 1).padStart(2, "0")}</span>
            </aside>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

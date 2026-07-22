"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CelestialBackground } from "@/components/motion/celestial-background";

const scenes = [
  { eyebrow: "An ordinary day", title: "Brian was working.", body: "Nothing cinematic. Just a normal day, still in progress.", visual: "work" },
  { eyebrow: "Then something shifted", title: "Jessica’s profile appeared.", body: "A small interruption arrived in the middle of the ordinary.", visual: "profile" },
  { eyebrow: "Saved for later", title: "One screenshot.", body: "Brian saved it so he could message properly when work was done.", visual: "flash" },
  { eyebrow: "Not exactly discreet", title: "The app revealed it immediately.", body: "Snapchat announced the screenshot before the moment could quietly pass.", visual: "ripple" },
  { eyebrow: "The honest next step", title: "Brian explained himself.", body: "This reconstruction invents no messages—only the explanation that followed.", visual: "bubbles" },
  { eyebrow: "A moment became a thread", title: "They kept talking.", body: "The explanation did not end the moment. It became an ongoing conversation.", visual: "connection" },
  { eyebrow: "And somehow", title: "The Beginning of Maybe.", body: "An ordinary working day became a beginning worth remembering, without rushing what comes next.", visual: "maybe" },
] as const;

const rooms = [
  { name: "Storybook", note: "Pages from the beginning", x: 50, y: 8 },
  { name: "Library", note: "A quiet reading room", x: 76, y: 17 },
  { name: "Puzzle Room", note: "Small, forgiving curiosities", x: 91, y: 39 },
  { name: "Jessica’s Radio", note: "Songs chosen with care", x: 84, y: 68 },
  { name: "Question Garden", note: "Thoughtful questions, always optional", x: 62, y: 88 },
  { name: "Gallery", note: "A few meaningful moments", x: 36, y: 88 },
  { name: "Our Journey", note: "Only milestones that truly happen", x: 15, y: 68 },
  { name: "Maybe Days", note: "Gentle ideas for time together", x: 9, y: 39 },
  { name: "Our Corner", note: "A calm private conversation space", x: 24, y: 17 },
  { name: "Open When", note: "Letters for another phase", x: 50, y: 30 },
] as const;

type WorldExperienceProps = { logoutAction: () => Promise<void> };
type SceneVisual = (typeof scenes)[number]["visual"];

function StoryVisual({ kind, paused }: { kind: SceneVisual; paused: boolean }) {
  return (
    <motion.div className={`story-visual story-visual-${kind} ${paused ? "is-paused" : ""}`} aria-hidden="true" initial={{ scale: .92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <div className="visual-depth-ring" />
      {kind === "work" ? <div className="work-scene"><span className="work-lamp" /><span className="work-screen" /><span className="work-desk" /><i /><i /><i /></div> : null}
      {kind === "profile" ? <div className="floating-phone"><span className="phone-speaker" /><strong>J</strong><i /><i /></div> : null}
      {kind === "flash" ? <><div className="floating-phone flash-phone"><strong>J</strong></div><span className="screenshot-flash" /></> : null}
      {kind === "ripple" ? <div className="notice-core"><span>!</span><i /><i /><i /></div> : null}
      {kind === "bubbles" ? <div className="conversation-visual"><span /><span /><span /><span /></div> : null}
      {kind === "connection" ? <div className="light-connection"><span /><i /><span /></div> : null}
      {kind === "maybe" ? <div className="maybe-reveal"><span>✦</span><i /><i /></div> : null}
    </motion.div>
  );
}

function Globe({ selected, onSelect, reduceMotion }: { selected: number; onSelect: (index: number) => void; reduceMotion: boolean }) {
  const [interacting, setInteracting] = useState(false);
  const path = rooms.map((room) => `${room.x},${room.y}`).join(" ");

  return (
    <div className={`globe-shell ${interacting ? "is-interacting" : ""} ${reduceMotion ? "is-reduced" : ""}`} onPointerEnter={() => setInteracting(true)} onPointerLeave={() => setInteracting(false)} onPointerDown={() => setInteracting(true)} onPointerUp={() => window.setTimeout(() => setInteracting(false), 1400)} onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
      <div className="world-globe" role="group" aria-label="Connected map of ten future rooms">
        <svg className="globe-grid" viewBox="0 0 100 100" aria-hidden="true">
          <defs><radialGradient id="globeGlow"><stop offset="0" stopColor="#6e2b41" stopOpacity=".5"/><stop offset="1" stopColor="#101327" stopOpacity=".08"/></radialGradient></defs>
          <circle cx="50" cy="50" r="47" fill="url(#globeGlow)" />
          <ellipse cx="50" cy="50" rx="47" ry="15" />
          <ellipse cx="50" cy="50" rx="47" ry="31" />
          <ellipse cx="50" cy="50" rx="18" ry="47" />
          <ellipse cx="50" cy="50" rx="35" ry="47" />
          <circle cx="50" cy="50" r="47" />
          <motion.polyline points={`${path} ${rooms[0].x},${rooms[0].y}`} className="globe-path" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduceMotion ? 0 : 2.4 }} />
          <motion.line x1="50" y1="30" x2={rooms[selected].x} y2={rooms[selected].y} className="selected-path" />
        </svg>
        <div className="globe-heart" aria-hidden="true"><span>✦</span><small>Maybe</small></div>
        {rooms.map((room, index) => (
          <button key={room.name} type="button" className="globe-node" style={{ "--node-x": `${room.x}%`, "--node-y": `${room.y}%` } as CSSProperties} aria-pressed={selected === index} aria-label={`${room.name}, locked, coming later`} onClick={() => onSelect(index)}>
            <span aria-hidden="true" />
            <strong className={index % 2 === 0 ? "node-label-right" : "node-label-left"}>{room.name}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorldExperience({ logoutAction }: WorldExperienceProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const [view, setView] = useState<"opening" | "world">("opening");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduceMotion);
  const [selectedRoom, setSelectedRoom] = useState(0);
  const scene = scenes[sceneIndex];
  const selected = rooms[selectedRoom];

  useEffect(() => {
    if (!playing || reduceMotion || view !== "opening") return;
    const timer = window.setTimeout(() => {
      if (sceneIndex === scenes.length - 1) setView("world");
      else setSceneIndex((current) => current + 1);
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [playing, reduceMotion, sceneIndex, view]);

  const showWorld = () => { setPlaying(false); setView("world"); };
  const replay = () => { setSceneIndex(0); setPlaying(!reduceMotion); setView("opening"); };
  const backStory = () => {
    setPlaying(false);
    setSceneIndex((current) => Math.max(0, current - 1));
  };
  const returnToStory = () => {
    setSceneIndex(scenes.length - 1);
    setPlaying(false);
    setView("opening");
  };
  const continueStory = () => sceneIndex === scenes.length - 1 ? showWorld() : setSceneIndex((current) => current + 1);
  const transition = { duration: reduceMotion ? 0 : .7, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="world-experience">
      <CelestialBackground moonProgress={view === "world" ? 1 : sceneIndex / (scenes.length - 1)} />
      <header className="world-toolbar">
        <div className="world-wordmark"><span aria-hidden="true">✦</span><p>The Beginning of Maybe</p></div>
        <div className="world-toolbar-actions">
          {view === "opening" ? <Button type="button" variant="quiet" size="small" onClick={showWorld}>Skip</Button> : <Button type="button" variant="quiet" size="small" onClick={replay}>Replay</Button>}
          <form action={logoutAction}><Button type="submit" variant="secondary" size="small">Log out</Button></form>
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {view === "opening" ? (
          <motion.main className="cinematic-opening" key={`scene-${sceneIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: reduceMotion ? 1 : 1.03 }} transition={transition}>
            <div className="scene-counter" aria-label={`Scene ${sceneIndex + 1} of ${scenes.length}`}><span>{String(sceneIndex + 1).padStart(2, "0")}</span><i><b style={{ width: `${((sceneIndex + 1) / scenes.length) * 100}%` }} /></i><span>{String(scenes.length).padStart(2, "0")}</span></div>
            <section className="cinematic-scene" aria-live="polite" aria-labelledby="story-title">
              <motion.div className="cinematic-copy" initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...transition, delay: reduceMotion ? 0 : .15 }}>
                <Badge tone="rose">A playful reconstruction</Badge>
                <p className="opening-eyebrow">{scene.eyebrow}</p>
                <h1 id="story-title">{scene.title}</h1>
                <p>{scene.body}</p>
                <div className="cinematic-controls">
                  <Button type="button" variant="quiet" onClick={backStory} disabled={sceneIndex === 0}>Back</Button>
                  <Button type="button" onClick={continueStory}>{sceneIndex === scenes.length - 1 ? "Enter the world" : "Continue"}</Button>
                  <Button type="button" variant="secondary" onClick={() => setPlaying((current) => !current)} aria-pressed={!playing}>{playing ? "Pause" : "Play"}</Button>
                </div>
                <small>{reduceMotion ? "Reduced motion is active; scenes advance only when you choose." : playing ? "Playing automatically" : "Paused"}</small>
              </motion.div>
              <StoryVisual kind={scene.visual} paused={!playing} />
            </section>
          </motion.main>
        ) : (
          <motion.main className="globe-view" key="globe" initial={{ opacity: 0, scale: reduceMotion ? 1 : .86 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduceMotion ? 0 : 1.1, ease: transition.ease }}>
            <header className="globe-header">
              <Badge tone="gold">Your private world</Badge>
              <h1>A world of what may come next.</h1>
              <p>Every destination remains locked. Focus or tap a light to preview its future room.</p>
              <Button type="button" variant="quiet" size="small" onClick={returnToStory}>Back to story</Button>
            </header>
            <Globe selected={selectedRoom} onSelect={setSelectedRoom} reduceMotion={reduceMotion} />
            <aside className="globe-detail" aria-live="polite"><div><Badge>Locked · Coming later</Badge><h2>{selected.name}</h2><p>{selected.note}</p></div><span aria-hidden="true">{String(selectedRoom + 1).padStart(2, "0")}</span></aside>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

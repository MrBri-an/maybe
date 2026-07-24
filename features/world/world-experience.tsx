"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CelestialBackground } from "@/components/motion/celestial-background";
import { JourneyProgressMenu } from "@/features/progression/journey-progress-menu";
import { JOURNEY_ROOMS, getJourneyNavigation, getJourneyStates, getJourneySummary } from "@/lib/progression/rooms";
import { recordWorldDestination, recordWorldLocation } from "@/app/world/actions";

const scenes = [
  { eyebrow: "An ordinary day", title: "Brian was working.", body: "Nothing cinematic. Just a normal day, still in progress.", visual: "work" },
  { eyebrow: "Then something shifted", title: "Jessica’s profile appeared.", body: "A small interruption arrived in the middle of the ordinary.", visual: "profile" },
  { eyebrow: "Saved for later", title: "One screenshot.", body: "Brian saved it so he could message properly when work was done.", visual: "flash" },
  { eyebrow: "Not exactly discreet", title: "The app revealed it immediately.", body: "Snapchat announced the screenshot before the moment could quietly pass.", visual: "ripple" },
  { eyebrow: "The honest next step", title: "Brian explained himself.", body: "This reconstruction invents no messages—only the explanation that followed.", visual: "bubbles" },
  { eyebrow: "A moment became a thread", title: "They kept talking.", body: "The explanation did not end the moment. It became an ongoing conversation.", visual: "connection" },
  { eyebrow: "And somehow", title: "The Beginning of Maybe.", body: "An ordinary working day became a beginning worth remembering, without rushing what comes next.", visual: "maybe" },
] as const;

const rooms = JOURNEY_ROOMS;

type WorldExperienceProps = { logoutAction: () => Promise<void>; initialView?: "opening" | "world"; storybookCompleted?: boolean; libraryCompleted?: boolean; puzzleRoomCompleted?: boolean; radioCompleted?: boolean; questionGardenCompleted?: boolean; galleryCompleted?: boolean; initialDestination?: string | null };
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

function Globe({ selected, onSelect, reduceMotion, storybookCompleted, libraryCompleted, puzzleRoomCompleted, radioCompleted, questionGardenCompleted, galleryCompleted }: { selected: number; onSelect: (index: number) => void; reduceMotion: boolean; storybookCompleted: boolean; libraryCompleted: boolean; puzzleRoomCompleted: boolean; radioCompleted: boolean; questionGardenCompleted: boolean; galleryCompleted: boolean }) {
  const router = useRouter();
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
          <motion.line x1={rooms[0].x} y1={rooms[0].y} x2={rooms[1].x} y2={rooms[1].y} className={`progression-path ${storybookCompleted ? "is-active" : ""}`} />
        </svg>
        <div className="globe-heart" aria-hidden="true"><span>✦</span><small>Maybe</small></div>
        {rooms.map((room, index) => (
          <button key={room.name} type="button" className={`globe-node ${((index === 0 && storybookCompleted) || (index === 1 && libraryCompleted) || (index === 2 && puzzleRoomCompleted) || (index === 3 && radioCompleted) || (index === 4 && questionGardenCompleted) || (index === 5 && galleryCompleted)) ? "is-completed" : ""} ${((index === 0 && !storybookCompleted) || (index === 1 && storybookCompleted && !libraryCompleted) || (index === 2 && libraryCompleted && !puzzleRoomCompleted) || (index === 3 && puzzleRoomCompleted && !radioCompleted) || (index === 4 && radioCompleted && !questionGardenCompleted) || (index === 5 && questionGardenCompleted && !galleryCompleted) || (index === 6 && galleryCompleted)) ? "is-current-destination" : ""}`} style={{ "--node-x": `${room.x}%`, "--node-y": `${room.y}%` } as CSSProperties} aria-pressed={selected === index} aria-label={index === 0 ? storybookCompleted ? "Storybook, completed and available" : "Storybook, current destination" : index === 1 ? libraryCompleted ? "Library, completed and available" : storybookCompleted ? "Library, current destination and available" : "Library, locked." : index === 2 ? puzzleRoomCompleted ? "Puzzle Room, completed and available" : libraryCompleted ? "Puzzle Room, current destination and available" : "Puzzle Room, locked." : index === 3 ? radioCompleted ? "Jessica’s Radio, completed and available" : puzzleRoomCompleted ? "Jessica’s Radio, current destination and available" : "Jessica’s Radio, coming later" : index === 4 ? questionGardenCompleted ? "Question Garden, completed and available" : radioCompleted ? "Question Garden, current destination and available" : "Question Garden, coming later" : index === 5 ? galleryCompleted ? "Gallery, completed and available" : questionGardenCompleted ? "Gallery, current destination and available" : "Gallery, coming later" : index === 6 && galleryCompleted ? "Our Journey, next destination, coming later" : `${room.name}, coming later.`} onClick={() => onSelect(index)} onPointerEnter={() => { if (room.route && index <= 5) router.prefetch(room.route); }} disabled={index > 5 || (index === 1 && !storybookCompleted) || (index === 2 && !libraryCompleted) || (index === 3 && !puzzleRoomCompleted) || (index === 4 && !radioCompleted) || (index === 5 && !questionGardenCompleted)}>
            <span aria-hidden="true" />
            <strong className={index % 2 === 0 ? "node-label-right" : "node-label-left"}>{room.name}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressionGuide({ storybookCompleted, libraryCompleted, puzzleRoomCompleted, radioCompleted, questionGardenCompleted, galleryCompleted }: { storybookCompleted: boolean; libraryCompleted: boolean; puzzleRoomCompleted: boolean; radioCompleted: boolean; questionGardenCompleted: boolean; galleryCompleted: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const states = getJourneyStates(storybookCompleted, libraryCompleted, puzzleRoomCompleted, radioCompleted, questionGardenCompleted, galleryCompleted);
  const summary = getJourneySummary(storybookCompleted, libraryCompleted, puzzleRoomCompleted, radioCompleted, questionGardenCompleted, galleryCompleted);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCollapsed(window.localStorage.getItem("maybe-world-guide-collapsed") === "1"));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const toggle = () => setCollapsed((current) => {
    window.localStorage.setItem("maybe-world-guide-collapsed", current ? "0" : "1");
    return !current;
  });
  return (
    <section className={`world-progression-guide ${collapsed ? "is-collapsed" : ""}`}>
      <header><div><p>World progression</p><h2>How this little world opens</h2></div><button type="button" onClick={toggle} aria-expanded={!collapsed} aria-controls="world-guide-content">{collapsed ? "Show guide" : "Hide guide"}</button></header>
      {!collapsed ? <div id="world-guide-content">
        <p>Each destination holds a part of the story. Begin with the rooms that are glowing. Complete what is inside, then return to the world to discover what opens next.</p>
        <div className="world-progression-path" aria-label={`${states.storybook} Storybook, ${states.library} Library, ${states.puzzleRoom} Puzzle Room, ${states.radio} Jessica’s Radio`}>
          <span className={`is-${states.storybook}`}><i>01</i><strong>Storybook</strong><small>{states.storybook === "completed" ? "Completed" : "Current"}</small></span><b aria-hidden="true">→</b>
          <span className={`is-${states.library}`}><i>02</i><strong>Library</strong><small>{states.library === "completed" ? "Completed" : states.library === "current" ? "Available" : "Locked"}</small></span><b className="is-soft" aria-hidden="true">→</b>
          <span className={`is-${states.puzzleRoom}`}><i>03</i><strong>Puzzle Room</strong><small>{states.puzzleRoom === "completed" ? "Completed" : states.puzzleRoom === "current" ? "Available" : states.puzzleRoom === "locked" ? "Locked" : "Coming later"}</small></span><b className="is-soft" aria-hidden="true">→</b>
          <span className={`is-${states.radio}`}><i>04</i><strong>Jessica’s Radio</strong><small>{states.radio === "completed" ? "Completed" : states.radio === "current" ? "Available" : "Coming later"}</small></span>
        </div>
        <p>The Storybook is the first destination. Reach its final page to unlock the Library. The other rooms will open later as their stories and experiences become ready.</p>
        <div className="world-guide-footer"><strong>{summary.message}{summary.completed > 0 ? ` · ${summary.completed} completed` : ""}</strong><ul aria-label="Progress state legend"><li><i className="available" />Available</li><li><i className="current" />Current</li><li><i className="completed" />Completed</li><li><i className="locked" />Locked</li><li><i className="later" />Coming later</li></ul></div>
      </div> : null}
    </section>
  );
}

function WorldRoomDetail({ selectedRoom, selected, storybookCompleted, libraryCompleted, puzzleRoomCompleted, radioCompleted, questionGardenCompleted, galleryCompleted }: {
  selectedRoom: number;
  selected: (typeof rooms)[number];
  storybookCompleted: boolean;
  libraryCompleted: boolean;
  puzzleRoomCompleted: boolean;
  radioCompleted: boolean;
  questionGardenCompleted: boolean;
  galleryCompleted: boolean;
}) {
  const completed = selectedRoom === 0 && storybookCompleted
    || selectedRoom === 1 && libraryCompleted
    || selectedRoom === 2 && puzzleRoomCompleted
    || selectedRoom === 3 && radioCompleted
    || selectedRoom === 4 && questionGardenCompleted
    || selectedRoom === 5 && galleryCompleted;
  const available = selectedRoom === 0
    || selectedRoom === 1 && storybookCompleted
    || selectedRoom === 2 && libraryCompleted
    || selectedRoom === 3 && puzzleRoomCompleted
    || selectedRoom === 4 && radioCompleted
    || selectedRoom === 5 && questionGardenCompleted;
  const navigation = getJourneyNavigation(selected.slug, {
    storybook: storybookCompleted,
    library: libraryCompleted,
    puzzleRoom: puzzleRoomCompleted,
    radio: radioCompleted,
    questionGarden: questionGardenCompleted,
    gallery: galleryCompleted,
  });
  const descriptions = [
    storybookCompleted ? "The first story is complete. You can return whenever you like." : "Begin with the story of the screenshot that started everything.",
    libraryCompleted ? "This quiet reading room is open whenever you want to return." : storybookCompleted ? "A private reading room for books, stories and discoveries." : "Complete the Storybook to open this quiet reading room.",
    puzzleRoomCompleted ? "The clues remain here whenever you feel like returning." : libraryCompleted ? "A playful room of clues and small discoveries." : "Complete the Library journey to open this playful room.",
    radioCompleted ? "The music library remains open whenever you want to return." : puzzleRoomCompleted ? "A private shared music library for favourite songs and discoveries." : "This destination will open later as the world continues to grow.",
    radioCompleted ? "A private garden of thoughtful questions, always optional." : "This destination will open later as the world continues to grow.",
    questionGardenCompleted ? "A private moonlit gallery for shared images and little films." : "Complete the Question Garden to open this quiet Gallery.",
    galleryCompleted ? "A place to trace the moments, milestones and memories that brought you here." : "This destination will open later as the world continues to grow.",
  ];
  const entryLabel = selectedRoom === 0 ? "Enter Storybook" : `Enter ${selected.name}`;
  return <aside className="globe-detail" aria-live="polite"><div>
    <Badge tone={available || selectedRoom === 6 && galleryCompleted ? "gold" : "neutral"}>{completed ? "Completed" : available ? "Available" : selectedRoom === 6 && galleryCompleted ? "Next destination" : selectedRoom <= 2 ? "Locked" : "Coming later"}</Badge>
    <h2>{selected.name}</h2>
    <p>{descriptions[selectedRoom] ?? "This destination will open later as the world continues to grow."}</p>
    {completed ? <div className="globe-detail-actions">
      {navigation.visitHref ? <Link className="button button-secondary button-small" href={navigation.visitHref} prefetch>{navigation.visitLabel}</Link> : null}
      {navigation.nextHref ? <Link className="button button-primary button-small" href={navigation.nextHref} prefetch>{navigation.nextLabel}</Link> : <span aria-disabled="true">{navigation.nextLabel}</span>}
    </div> : available && navigation.visitHref ? <Link className="button button-primary button-small globe-enter-story" href={navigation.visitHref} prefetch>{entryLabel}</Link> : null}
  </div><span aria-hidden="true">{String(selectedRoom + 1).padStart(2, "0")}</span></aside>;
}

export function WorldExperience({ logoutAction, initialView = "opening", storybookCompleted = false, libraryCompleted = false, puzzleRoomCompleted = false, radioCompleted = false, questionGardenCompleted = false, galleryCompleted = false, initialDestination = null }: WorldExperienceProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const router = useRouter();
  const [view, setView] = useState<"opening" | "world">(initialView);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduceMotion);
  const [selectedRoom, setSelectedRoom] = useState(() => {
    const savedIndex = rooms.findIndex((room) => room.slug === initialDestination);
    if (savedIndex === 0 || (savedIndex === 1 && storybookCompleted) || (savedIndex === 2 && libraryCompleted) || (savedIndex === 3 && puzzleRoomCompleted) || (savedIndex === 4 && radioCompleted) || (savedIndex === 5 && questionGardenCompleted) || (savedIndex === 6 && galleryCompleted)) return savedIndex;
    return galleryCompleted ? 6 : questionGardenCompleted ? 5 : radioCompleted ? 4 : puzzleRoomCompleted ? 3 : libraryCompleted ? 2 : storybookCompleted ? 1 : 0;
  });
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

  useEffect(() => {
    if (view !== "world") return;
    void recordWorldLocation();
    router.prefetch("/story");
    if (storybookCompleted) router.prefetch("/library");
    if (libraryCompleted) router.prefetch("/puzzles");
    if (puzzleRoomCompleted) router.prefetch("/radio");
    if (radioCompleted) router.prefetch("/question-garden");
    if (questionGardenCompleted) router.prefetch("/gallery");
  }, [libraryCompleted, puzzleRoomCompleted, questionGardenCompleted, radioCompleted, router, storybookCompleted, view]);

  const selectRoom = (index: number) => {
    setSelectedRoom(index);
    void recordWorldDestination(rooms[index].slug);
  };

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
              <p>{storybookCompleted ? "Storybook and Library are open. The other destinations remain gently locked." : "Begin with the Storybook. The other destinations remain gently locked."}</p>
              <Button type="button" variant="quiet" size="small" onClick={returnToStory}>Back to story</Button>
              <JourneyProgressMenu storybookCompleted={storybookCompleted} libraryCompleted={libraryCompleted} puzzleRoomCompleted={puzzleRoomCompleted} radioCompleted={radioCompleted} questionGardenCompleted={questionGardenCompleted} galleryCompleted={galleryCompleted} />
            </header>
            <Globe selected={selectedRoom} onSelect={selectRoom} reduceMotion={reduceMotion} storybookCompleted={storybookCompleted} libraryCompleted={libraryCompleted} puzzleRoomCompleted={puzzleRoomCompleted} radioCompleted={radioCompleted} questionGardenCompleted={questionGardenCompleted} galleryCompleted={galleryCompleted} />
            <WorldRoomDetail selectedRoom={selectedRoom} selected={selected} storybookCompleted={storybookCompleted} libraryCompleted={libraryCompleted} puzzleRoomCompleted={puzzleRoomCompleted} radioCompleted={radioCompleted} questionGardenCompleted={questionGardenCompleted} galleryCompleted={galleryCompleted} />
            <ProgressionGuide storybookCompleted={storybookCompleted} libraryCompleted={libraryCompleted} puzzleRoomCompleted={puzzleRoomCompleted} radioCompleted={radioCompleted} questionGardenCompleted={questionGardenCompleted} galleryCompleted={galleryCompleted} />
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

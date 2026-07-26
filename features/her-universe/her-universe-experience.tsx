"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { completeHerUniverseJourney, recordCelestialObjectVisit } from "@/app/her-universe/actions";
import { CelestialBackground } from "@/components/motion/celestial-background";
import { JourneyProgressMenu } from "@/features/progression/journey-progress-menu";
import { ObjectInterior } from "@/features/her-universe/object-interior";
import { RoomCompletionPanel } from "@/features/progression/room-completion-panel";
import type { HerUniverseObjectDetail, HerUniverseObjectView } from "@/lib/her-universe/contracts";

const objectPresentation: Record<string, { caption: string; x: number; y: number }> = {
  "sun-of-her-warmth": { caption: "The warmth you carry without even trying.", x: 12, y: 22 },
  "moon-of-her-calm": { caption: "The quiet light that makes everything feel less heavy.", x: 39, y: 10 },
  "galaxy-of-her-beauty": { caption: "There are too many beautiful things about you to fit inside one star.", x: 70, y: 20 },
  "planet-of-her-strength": { caption: "Some of your strongest moments happened quietly.", x: 87, y: 43 },
  "nebula-of-her-mind": { caption: "Your mind holds colours people may never fully see.", x: 68, y: 68 },
  "constellation-of-little-things": { caption: "The little things are never little when they belong to you.", x: 38, y: 79 },
  "ocean-moon": { caption: "There is more beneath the surface than most people will ever know.", x: 12, y: 65 },
  "north-star": { caption: "Out of every light, somehow, I noticed yours.", x: 49, y: 43 },
  "unnamed-star": { caption: "Some things about you are still waiting to be discovered.", x: 23, y: 42 },
};

function presentationFor(object: HerUniverseObjectView) {
  return objectPresentation[object.slug] ?? { caption: object.caption, x: 50, y: 50 };
}

export function HerUniverseExperience({ objects, herUniverseCompleted }: { objects: HerUniverseObjectView[]; herUniverseCompleted: boolean }) {
  const reduceMotion = Boolean(useReducedMotion());
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [visited, setVisited] = useState(() => new Set(objects.filter((object) => object.visited).map((object) => object.slug)));
  const [visible, setVisible] = useState(true);
  const [detailCache, setDetailCache] = useState<Record<string, HerUniverseObjectDetail>>({});
  const visitLocks = useRef(new Set<string>());
  const completionLock = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const selected = selectedIndex === null ? null : objects[selectedIndex] ?? null;
  const activeIndex = selectedIndex ?? 0;

  const markVisited = useCallback((object: HerUniverseObjectView) => {
    if (visited.has(object.slug) || visitLocks.current.has(object.slug)) return;
    visitLocks.current.add(object.slug);
    void recordCelestialObjectVisit(object.slug)
      .then((result) => {
        if (result.ok) setVisited((current) => new Set(current).add(object.slug));
      })
      .finally(() => visitLocks.current.delete(object.slug));
  }, [visited]);

  const openObject = useCallback((index: number) => {
    const object = objects[index];
    if (!object) return;
    setSelectedIndex(index);
    markVisited(object);
  }, [markVisited, objects]);
  const cacheDetail = useCallback((slug: string, detail: HerUniverseObjectDetail) => {
    setDetailCache((current) => current[slug] === detail ? current : { ...current, [slug]: detail });
  }, []);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => () => {
    if (fallback.current) clearTimeout(fallback.current);
  }, []);

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowLeft") openObject((selectedIndex - 1 + objects.length) % objects.length);
      if (event.key === "ArrowRight") openObject((selectedIndex + 1) % objects.length);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [objects.length, openObject, selectedIndex]);

  const visitedCount = visited.size;
  const completeJourney = async () => {
    if (completionLock.current) return;
    completionLock.current = true;
    setCompletionPending(true);
    setCompletionError("");
    try {
      const result = await completeHerUniverseJourney();
      if (result.ok) {
        router.replace("/maybe-days");
        fallback.current = setTimeout(() => {
          if (window.location.pathname === "/her-universe") window.location.assign("/maybe-days");
        }, 1500);
        return;
      }
      setCompletionError(result.error);
    } catch {
      setCompletionError("The next step could not be saved. Please try again.");
    } finally {
      if (!fallback.current) {
        completionLock.current = false;
        setCompletionPending(false);
      }
    }
  };
  const paths = useMemo(() => objects.slice(0, -1).map((object, index) => {
    const from = presentationFor(object);
    const to = presentationFor(objects[index + 1]);
    const curvedY = Math.max(0, Math.min(100, (from.y + to.y) / 2 + (index % 2 ? 8 : -8)));
    return { d: `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${curvedY} ${to.x} ${to.y}`, active: visited.has(object.slug) || visited.has(objects[index + 1].slug) };
  }), [objects, visited]);

  return (
    <main className={`her-universe-shell ${visible ? "" : "is-paused"}`} style={{ "--universe-richness": objects.length ? visitedCount / objects.length : 0 } as CSSProperties}>
      <CelestialBackground room="her-universe" moonProgress={0.72} />
      <div className="her-universe-atmosphere" aria-hidden="true"><i /><i /><i /><i /><span /><span /></div>
      <nav className="her-universe-nav" aria-label="Her Universe navigation">
        <Link href="/?view=world">Return to World</Link>
        <JourneyProgressMenu storybookCompleted libraryCompleted puzzleRoomCompleted radioCompleted questionGardenCompleted galleryCompleted herUniverseCompleted={herUniverseCompleted} />
      </nav>

      {!entered ? (
        <motion.section className="her-universe-intro" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <span className="her-universe-orbit" aria-hidden="true"><i /><i /><i /></span>
          <p>World seven</p>
          <h1>Her Universe</h1>
          <blockquote>Some people can be described with a few words. You needed an entire universe.</blockquote>
          <button type="button" onClick={() => setEntered(true)}>Enter Her Universe</button>
        </motion.section>
      ) : selected ? (
        <ObjectInterior
          key={selected.slug}
          object={selected}
          index={activeIndex}
          total={objects.length}
          caption={presentationFor(selected).caption}
          cached={detailCache[selected.slug]}
          adjacentSlugs={[
            objects[(activeIndex - 1 + objects.length) % objects.length]?.slug,
            objects[(activeIndex + 1) % objects.length]?.slug,
          ].filter((slug): slug is string => Boolean(slug))}
          onCache={cacheDetail}
          onPrevious={() => openObject((activeIndex - 1 + objects.length) % objects.length)}
          onNext={() => openObject((activeIndex + 1) % objects.length)}
          onReturn={() => setSelectedIndex(null)}
        />
      ) : (
        <motion.section id="her-universe-map" className="her-universe-map" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
          <header><p>A private celestial atlas</p><h1>Her Universe</h1><span>{visitedCount ? `${visitedCount} of ${objects.length} lights visited.` : "Follow any light. Every path remains open."}</span></header>
          <div className="her-universe-objects" role="list" aria-label="Connected celestial objects">
            <svg className="her-universe-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {paths.map((path, index) => <path key={index} d={path.d} className={path.active ? "is-active" : ""} />)}
              <path className={visited.has("north-star") ? "is-active" : ""} d="M 23 42 Q 36 28 49 43 Q 68 36 87 43" />
            </svg>
            {objects.map((object, index) => {
              const presentation = presentationFor(object);
              return (
                <button
                  key={object.slug}
                  type="button"
                  role="listitem"
                  className={`her-universe-object is-${object.objectType} ${visited.has(object.slug) ? "is-visited" : ""}`}
                  style={{ "--object-x": `${presentation.x}%`, "--object-y": `${presentation.y}%`, "--object-index": index } as CSSProperties}
                  onClick={() => openObject(index)}
                >
                  <CelestialBody object={object} index={index} />
                  <strong>{object.name}</strong>
                  <span>{presentation.caption}</span>
                  {visited.has(object.slug) ? <small>Visited</small> : null}
                </button>
              );
            })}
          </div>
        </motion.section>
      )}
      {entered && selectedIndex === null ? <RoomCompletionPanel
        title="There is still more to discover"
        message="This universe will remain here, waiting for every new thing about you that deserves its own light."
        primary={herUniverseCompleted
          ? <Link href="/maybe-days" prefetch>Continue the journey</Link>
          : <button type="button" disabled={completionPending} aria-busy={completionPending} onClick={() => void completeJourney()}>{completionPending ? "Continuing…" : "Continue the journey"}</button>}
        secondary={<button type="button" onClick={() => document.getElementById("her-universe-map")?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" })}>Explore Her Universe again</button>}
      >{completionError ? <p role="alert">{completionError}</p> : null}</RoomCompletionPanel> : null}
    </main>
  );
}

function CelestialBody({ object, index = 0, large = false }: { object: HerUniverseObjectView; index?: number; large?: boolean }) {
  const style = {
    "--object-float-duration": `${3 + (index % 5) * .45}s`,
    "--object-float-x": `${6 + (index % 4) * 4}px`,
    "--object-float-y": `${14 + (index % 5) * 3.5}px`,
    "--object-float-rotate": `${1 + (index % 3)}deg`,
    "--object-float-delay": `${-.35 - (index % 6) * .62}s`,
  } as CSSProperties;
  return (
    <span className={`her-celestial-body is-${object.objectType} ${large ? "is-large" : ""}`} style={style} aria-hidden="true">
      <i className="body-core" />
      <i className="body-orbit" />
      <i className="body-detail" />
      <i className="body-stars" />
    </span>
  );
}

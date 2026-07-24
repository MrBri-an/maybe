"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { completeGalleryJourney, loadMoreGalleryMedia } from "@/app/gallery/actions";
import { CelestialBackground } from "@/components/motion/celestial-background";
import { JourneyProgressMenu } from "@/features/progression/journey-progress-menu";
import { RoomCompletionPanel } from "@/features/progression/room-completion-panel";
import { GalleryMediaCard, GalleryViewer } from "@/features/gallery/gallery-media";
import { GalleryUploader } from "@/features/gallery/gallery-uploader";
import type { PublicGalleryMedia } from "@/lib/gallery/media";

const PETALS = Array.from({ length: 7 }, (_, index) => ({
  left: `${8 + ((index * 17) % 84)}%`,
  delay: `${index * -1.1}s`,
}));
const FIREFLIES = Array.from({ length: 6 }, (_, index) => ({
  left: `${12 + ((index * 29) % 76)}%`,
  top: `${18 + ((index * 23) % 65)}%`,
  delay: `${index * -.7}s`,
}));

function GalleryJourneyPanel({ alreadyCompleted }: { alreadyCompleted: boolean }) {
  const router = useRouter();
  const lock = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (fallback.current) clearTimeout(fallback.current);
  }, []);

  if (alreadyCompleted) {
    return <RoomCompletionPanel
      title="Ready for the next memory?"
      message="This Gallery will remain open for every photograph and video you decide to keep here together."
      primary={<Link href="/?view=world" prefetch>Continue the journey</Link>}
    />;
  }

  const continueJourney = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await completeGalleryJourney();
      if (result.ok) {
        router.replace("/?view=world");
        fallback.current = setTimeout(() => {
          if (window.location.pathname === "/gallery") window.location.assign("/?view=world");
        }, 1500);
        return;
      }
      setError(result.error);
    } catch {
      setError("The next step could not be saved. Please try again.");
    } finally {
      if (!fallback.current) {
        lock.current = false;
        setPending(false);
      }
    }
  };

  return <RoomCompletionPanel
    title="Ready for the next memory?"
    message="This Gallery will remain open for every photograph and video you decide to keep here together."
    primary={<button type="button" disabled={pending} aria-busy={pending} onClick={() => void continueJourney()}>{pending ? "Continuing…" : "Continue the journey"}</button>}
  >
    {error ? <p role="alert">{error}</p> : null}
  </RoomCompletionPanel>;
}

export function GalleryExperience({ initialMedia, initialCursor, initialHasMore, galleryCompleted }: {
  initialMedia: PublicGalleryMedia[];
  initialCursor: string | null;
  initialHasMore: boolean;
  galleryCompleted: boolean;
}) {
  const [media, setMedia] = useState(initialMedia);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const paginationLock = useRef(false);
  const paginationVersion = useRef(0);
  const loadSentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateVisibility = () => {
      setPageHidden(document.hidden);
      if (document.hidden) document.querySelectorAll<HTMLVideoElement>("[data-gallery-video]").forEach((video) => video.pause());
    };
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore || paginationLock.current) return;
    paginationLock.current = true;
    setLoadingMore(true);
    const version = ++paginationVersion.current;
    try {
      const result = await loadMoreGalleryMedia(cursor);
      if (!result.ok || version !== paginationVersion.current) return;
      setMedia((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.media.filter((item) => !known.has(item.id))];
      });
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } finally {
      if (version === paginationVersion.current) {
        paginationLock.current = false;
        setLoadingMore(false);
      }
    }
  }, [cursor, hasMore]);

  useEffect(() => {
    const sentinel = loadSentinel.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadMore();
    }, { rootMargin: "500px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  useEffect(() => () => {
    paginationVersion.current += 1;
  }, []);

  const addMedia = (item: PublicGalleryMedia) => {
    setMedia((current) => [item, ...current.filter((candidate) => candidate.id !== item.id)]);
  };
  const updateMedia = (item: PublicGalleryMedia) => {
    setMedia((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));
  };
  const archiveMedia = (id: string) => {
    setMedia((current) => current.filter((candidate) => candidate.id !== id));
  };

  const fullness = Math.min(1, .35 + media.length * .035);
  return <main className={`gallery-shell ${pageHidden ? "is-paused" : ""}`} style={{ "--gallery-fullness": fullness } as CSSProperties}>
    <CelestialBackground room="garden" moonProgress={1} />
    <div className="gallery-botanical-shadow" aria-hidden="true"><i /><i /></div>
    <div className="gallery-vines" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="gallery-edge-flowers" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
    <div className="gallery-petals" aria-hidden="true">{PETALS.map((petal, index) => <i key={index} style={{ left: petal.left, animationDelay: petal.delay }} />)}</div>
    <div className="gallery-fireflies" aria-hidden="true">{FIREFLIES.map((firefly, index) => <i key={index} style={{ left: firefly.left, top: firefly.top, animationDelay: firefly.delay }} />)}</div>

    <header className="gallery-toolbar">
      <Link href="/?view=world">← Return to World</Link>
      <JourneyProgressMenu storybookCompleted libraryCompleted puzzleRoomCompleted radioCompleted questionGardenCompleted galleryCompleted={galleryCompleted} />
      <button type="button" onClick={() => setUploadOpen(true)}>Upload memories</button>
    </header>

    <section className="gallery-hero">
      <p>World 06 · A private room for shared light</p>
      <h1>Gallery</h1>
      <span>Images and little films can rest here quietly—kept between the two people this world belongs to.</span>
      <div className="gallery-central-floral" aria-hidden="true"><b>✦</b><i /><i /><i /><i /><i /></div>
    </section>

    <section className="gallery-frame" aria-labelledby="gallery-memories-title">
      <header><p>A moonlit collection</p><h2 id="gallery-memories-title">Shared memories</h2></header>
      {media.length === 0 ? <div className="gallery-empty">
        <span aria-hidden="true">❀</span>
        <h3>This space is waiting for the first memory.</h3>
        <p>There is no pressure to fill it quickly. One meaningful moment is enough to begin.</p>
        <button type="button" onClick={() => setUploadOpen(true)}>Upload memories</button>
      </div> : <div className="gallery-media-grid">
        {media.map((item, index) => <GalleryMediaCard key={item.id} media={item} onOpen={() => setViewerIndex(index)} />)}
      </div>}
      <div ref={loadSentinel} className="gallery-load-sentinel" aria-live="polite">
        {loadingMore ? "Gathering more memories…" : hasMore ? <button type="button" onClick={() => void loadMore()}>Load more memories</button> : media.length ? "You have reached the beginning of this collection." : null}
      </div>
    </section>

    <GalleryJourneyPanel alreadyCompleted={galleryCompleted} />

    <GalleryUploader open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={addMedia} />
    {viewerIndex !== null && media[viewerIndex] ? <GalleryViewer
      key={media[viewerIndex].id}
      media={media}
      index={viewerIndex}
      onClose={() => setViewerIndex(null)}
      onMove={setViewerIndex}
      onUpdated={updateMedia}
      onArchived={archiveMedia}
    /> : null}
  </main>;
}

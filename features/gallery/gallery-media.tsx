"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  archiveGalleryMemory,
  cleanupArchivedGalleryObject,
  getGalleryViewingUrl,
  updateGalleryMemory,
} from "@/app/gallery/actions";
import type { PublicGalleryMedia } from "@/lib/gallery/media";

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function useSignedGalleryUrl(id: string, active: boolean) {
  const cached = signedUrlCache.get(id);
  const [url, setUrl] = useState(() => cached && cached.expiresAt > Date.now() ? cached.url : null);
  const [revision, setRevision] = useState(0);
  const requestVersion = useRef(0);
  useEffect(() => {
    if (!active) return;
    const current = signedUrlCache.get(id);
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshAt = (expiresAt: number) => {
      expiryTimer = setTimeout(() => setRevision((value) => value + 1), Math.max(1_000, expiresAt - Date.now()));
    };
    if (current && current.expiresAt > Date.now()) {
      queueMicrotask(() => {
        if (!cancelled) setUrl(current.url);
      });
      refreshAt(current.expiresAt);
      return () => {
        cancelled = true;
        if (expiryTimer) clearTimeout(expiryTimer);
      };
    }
    const version = ++requestVersion.current;
    queueMicrotask(() => {
      if (!cancelled) setUrl(null);
    });
    void getGalleryViewingUrl(id).then((result) => {
      if (cancelled || version !== requestVersion.current || !result.ok) return;
      signedUrlCache.set(id, { url: result.url, expiresAt: result.expiresAt });
      setUrl(result.url);
      refreshAt(result.expiresAt);
    });
    return () => {
      cancelled = true;
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [active, id, revision]);
  return url;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function pauseOtherGalleryVideos(current?: HTMLVideoElement) {
  document.querySelectorAll<HTMLVideoElement>("[data-gallery-video]").forEach((video) => {
    if (video !== current) video.pause();
  });
}

export function GalleryMediaCard({ media, onOpen }: {
  media: PublicGalleryMedia;
  onOpen: () => void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [nearby, setNearby] = useState(false);
  const url = useSignedGalleryUrl(media.id, nearby);
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearby(true);
        observer.disconnect();
      }
    }, { rootMargin: "400px" });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  const ratio = media.width && media.height ? `${media.width} / ${media.height}` : media.media_kind === "video" ? "16 / 9" : "4 / 3";
  return <article ref={cardRef} className="gallery-memory" style={{ "--gallery-ratio": ratio } as CSSProperties}>
    <button type="button" className="gallery-memory-open" onClick={onOpen} aria-label={`Open ${media.title || "Gallery memory"}`}>
      <div className="gallery-memory-preview">
        {url ? media.media_kind === "image"
          // The source is a short-lived private URL requested only near the viewport.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt={media.title || "A shared Gallery memory"} loading="lazy" decoding="async" />
          : <video src={url} muted playsInline preload="metadata" data-gallery-video />
          : <span className="gallery-media-loading" aria-label="Preparing private preview" />}
        <small>{media.media_kind === "image" ? "Image" : "Video"}</small>
        {media.media_kind === "video" ? <i className="gallery-video-mark" aria-hidden="true">▶</i> : null}
      </div>
      <div className="gallery-memory-copy">
        <span>{media.uploader_label} · {dateLabel(media.created_at)}</span>
        <h3>{media.title || "Untitled memory"}</h3>
        {media.caption ? <p>{media.caption}</p> : null}
      </div>
    </button>
  </article>;
}

export function GalleryViewer({ media, index, onClose, onMove, onUpdated, onArchived }: {
  media: PublicGalleryMedia[];
  index: number;
  onClose: () => void;
  onMove: (index: number) => void;
  onUpdated: (media: PublicGalleryMedia) => void;
  onArchived: (id: string) => void;
}) {
  const item = media[index];
  const url = useSignedGalleryUrl(item.id, true);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const actionLock = useRef(false);
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = useCallback((direction: number) => {
    const next = (index + direction + media.length) % media.length;
    onMove(next);
  }, [index, media.length, onMove]);

  useEffect(() => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      const editingField = event.target instanceof Element && Boolean(event.target.closest("form"));
      if (event.key === "ArrowLeft" && !editingField) move(-1);
      if (event.key === "ArrowRight" && !editingField) move(1);
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, video[controls], [href]");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const visibility = () => {
      if (document.hidden) pauseOtherGalleryVideos();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("visibilitychange", visibility);
    const video = videoRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("visibilitychange", visibility);
      video?.pause();
      restoreFocus.current?.focus();
    };
  }, [move, onClose]);

  const save = async (formData: FormData) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setManaging(true);
    setError(null);
    formData.set("id", item.id);
    try {
      const result = await updateGalleryMemory(formData);
      if (!result.ok || !result.media) setError(result.error ?? "The memory could not be updated.");
      else {
        onUpdated(result.media);
        setEditing(false);
      }
    } catch {
      setError("The memory could not be updated.");
    } finally {
      actionLock.current = false;
      setManaging(false);
    }
  };

  const archive = async () => {
    if (actionLock.current || !window.confirm("Archive this memory? Its private file will remain preserved.")) return;
    actionLock.current = true;
    setManaging(true);
    setError(null);
    try {
      const result = await archiveGalleryMemory(item.id);
      if (!result.ok) setError(result.error ?? "The memory could not be archived.");
      else {
        onArchived(item.id);
        onClose();
        void cleanupArchivedGalleryObject(item.id);
      }
    } catch {
      setError("The memory could not be archived.");
    } finally {
      actionLock.current = false;
      setManaging(false);
    }
  };

  return <div className="gallery-viewer-backdrop" onPointerDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section ref={dialogRef} className="gallery-viewer" role="dialog" aria-modal="true" aria-labelledby="gallery-viewer-title">
      <header>
        <span>{item.media_kind === "image" ? "Private image" : "Private video"}</span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close media viewer">×</button>
      </header>
      <div className="gallery-viewer-stage">
        {url ? item.media_kind === "image"
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt={item.title || "A shared Gallery memory"} />
          : <video ref={videoRef} className={playing ? "is-playing" : ""} src={url} controls playsInline preload="metadata" data-gallery-video onPlay={(event) => { pauseOtherGalleryVideos(event.currentTarget); setPlaying(true); }} onPause={() => setPlaying(false)} />
          : <span className="gallery-media-loading" role="status">Preparing this private memory…</span>}
        {media.length > 1 ? <>
          <button type="button" className="gallery-viewer-previous" onClick={() => move(-1)} aria-label="Previous memory">←</button>
          <button type="button" className="gallery-viewer-next" onClick={() => move(1)} aria-label="Next memory">→</button>
        </> : null}
      </div>
      <div className="gallery-viewer-details">
        {editing ? <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void save(new FormData(event.currentTarget));
        }}>
          <label><span>Title</span><input name="title" defaultValue={item.title ?? ""} maxLength={160} /></label>
          <label><span>Caption</span><textarea name="caption" defaultValue={item.caption ?? ""} maxLength={2000} rows={4} /></label>
          <div><button type="button" onClick={() => setEditing(false)} disabled={managing}>Cancel</button><button type="submit" disabled={managing}>{managing ? "Saving…" : "Save details"}</button></div>
        </form> : <>
          <span>{item.uploader_label} · {dateLabel(item.created_at)}</span>
          <h2 id="gallery-viewer-title">{item.title || "Untitled memory"}</h2>
          {item.caption ? <p>{item.caption}</p> : null}
          {item.is_uploader ? <div className="gallery-viewer-manage"><button type="button" onClick={() => setEditing(true)} disabled={managing}>Edit details</button><button type="button" onClick={() => void archive()} disabled={managing}>{managing ? "Archiving…" : "Archive"}</button></div> : null}
        </>}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  </div>;
}

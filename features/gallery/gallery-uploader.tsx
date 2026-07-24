"use client";

import { useEffect, useRef, useState } from "react";
import {
  cancelGalleryUpload,
  finalizeGalleryUpload,
  prepareGalleryUpload,
} from "@/app/gallery/actions";
import {
  MAX_GALLERY_IMAGE_SIZE,
  MAX_GALLERY_VIDEO_SIZE,
  validateGalleryFile,
  type PublicGalleryMedia,
} from "@/lib/gallery/media";
import { getPublicSupabaseConfig } from "@/lib/supabase/public-config";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type UploadStatus = "pending" | "preparing" | "uploading" | "finalizing" | "success" | "failed";
type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  caption: string;
  status: UploadStatus;
  progress: number;
  error: string | null;
  ticket: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

function mediaMeasurements(file: File, url: string) {
  return new Promise<Pick<UploadItem, "width" | "height" | "durationSeconds">>((resolve) => {
    if (file.type.startsWith("image/")) {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null, durationSeconds: null });
      image.onerror = () => resolve({ width: null, height: null, durationSeconds: null });
      image.src = url;
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve({
      width: video.videoWidth || null,
      height: video.videoHeight || null,
      durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
    });
    video.onerror = () => resolve({ width: null, height: null, durationSeconds: null });
    video.src = url;
  });
}

async function directSignedUpload(signedUrl: string, file: File, onProgress: (progress: number) => void, signal: AbortSignal) {
  const { data: sessionData } = await createBrowserSupabaseClient().auth.getSession();
  return new Promise<void>((resolve, reject) => {
    const config = getPublicSupabaseConfig();
    if (!config) {
      reject(new Error("configuration"));
      return;
    }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal.addEventListener("abort", abort, { once: true });
    request.open("PUT", signedUrl);
    request.setRequestHeader("apikey", config.anonKey);
    request.setRequestHeader("Authorization", `Bearer ${sessionData.session?.access_token ?? config.anonKey}`);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onerror = () => reject(new Error("network"));
    request.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    request.onload = () => {
      signal.removeEventListener("abort", abort);
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("storage"));
    };
    const body = new FormData();
    body.append("cacheControl", "0");
    body.append("", file);
    request.send(body);
  });
}

export function GalleryUploader({ open, onClose, onUploaded }: {
  open: boolean;
  onClose: () => void;
  onUploaded: (media: PublicGalleryMedia) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [panelError, setPanelError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const startingRef = useRef(false);
  const active = useRef(new Map<string, AbortController>());
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (open) return;
    const previous = itemsRef.current;
    for (const item of previous) {
      URL.revokeObjectURL(item.previewUrl);
      active.current.get(item.id)?.abort();
      if (item.ticket) void cancelGalleryUpload(item.ticket);
    }
    active.current.clear();
    if (previous.length) queueMicrotask(() => setItems([]));
  }, [open]);

  const patch = (id: string, value: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...value } : item));
  };

  const releaseItem = (item: UploadItem) => {
    URL.revokeObjectURL(item.previewUrl);
    active.current.get(item.id)?.abort();
    active.current.delete(item.id);
    if (item.ticket) void cancelGalleryUpload(item.ticket);
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => fileInput.current?.focus());
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && active.current.size === 0) onClose();
    };
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", escape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  useEffect(() => () => {
    for (const item of itemsRef.current) {
      URL.revokeObjectURL(item.previewUrl);
      active.current.get(item.id)?.abort();
    }
  }, []);

  if (!open) return null;

  const selectFiles = async (files: FileList | null) => {
    if (!files) return;
    setPanelError(null);
    const additions: UploadItem[] = [];
    for (const file of Array.from(files)) {
      const validated = await validateGalleryFile(file);
      if (!validated.ok) {
        setPanelError(`${file.name}: ${validated.error}`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      const measurements = await mediaMeasurements(file, previewUrl);
      additions.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
        title: "",
        caption: "",
        status: "pending",
        progress: 0,
        error: null,
        ticket: null,
        ...measurements,
      });
    }
    setItems((current) => [...current, ...additions]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const uploadOne = async (id: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item || active.current.has(id) || active.current.size >= 2 || item.status === "success") return;
    const controller = new AbortController();
    active.current.set(id, controller);
    patch(id, { status: "preparing", progress: 0, error: null });
    let ticket: string | null = item.ticket;
    try {
      const preparation = await prepareGalleryUpload({
        filename: item.file.name,
        mime: item.file.type,
        size: item.file.size,
        title: item.title,
        caption: item.caption,
        width: item.width,
        height: item.height,
        durationSeconds: item.durationSeconds,
      });
      if (!preparation.ok) throw new Error(preparation.error);
      ticket = preparation.ticket;
      patch(id, { status: "uploading", ticket });
      await directSignedUpload(preparation.signedUrl, item.file, (progress) => patch(id, { progress }), controller.signal);
      patch(id, { status: "finalizing", progress: 100 });
      const finalized = await finalizeGalleryUpload(ticket);
      if (!finalized.ok || !finalized.media) throw new Error(finalized.error ?? "The memory could not be finalized.");
      patch(id, { status: "success", progress: 100, error: null, ticket: null });
      onUploaded(finalized.media);
    } catch (error) {
      if (ticket) void cancelGalleryUpload(ticket);
      if ((error as Error).name !== "AbortError") {
        patch(id, { status: "failed", progress: 0, error: error instanceof Error ? error.message : "Upload failed.", ticket: null });
      }
    } finally {
      active.current.delete(id);
    }
  };

  const startUploads = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    const queue = itemsRef.current.filter((item) => item.status === "pending" || item.status === "failed").map((item) => item.id);
    let index = 0;
    const worker = async () => {
      while (index < queue.length) {
        const id = queue[index++];
        await uploadOne(id);
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(2, queue.length) }, worker));
    } finally {
      startingRef.current = false;
    }
  };

  const remove = (id: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;
    releaseItem(item);
    setItems((current) => current.filter((candidate) => candidate.id !== id));
  };

  const busy = items.some((item) => item.status === "preparing" || item.status === "uploading" || item.status === "finalizing");
  const ready = items.some((item) => item.status === "pending" || item.status === "failed");

  return <div className="gallery-upload-backdrop" onPointerDown={(event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section className="gallery-upload-panel gallery-upload-queue" role="dialog" aria-modal="true" aria-labelledby="gallery-upload-title">
      <header><div><p>A private addition</p><h2 id="gallery-upload-title">Upload memories</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close upload panel">×</button></header>
      <label className="gallery-upload-picker">
        <span>Choose images or videos</span>
        <input ref={fileInput} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.avif,.mp4,.webm,.mov,.m4v,image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,video/x-m4v" onChange={(event) => void selectFiles(event.currentTarget.files)} />
        <small>Images up to {MAX_GALLERY_IMAGE_SIZE / 1024 / 1024} MB · Videos up to {MAX_GALLERY_VIDEO_SIZE / 1024 / 1024} MB</small>
      </label>
      {panelError ? <p role="alert">{panelError}</p> : null}
      <div className="gallery-upload-list" aria-live="polite">
        {items.map((item) => <article key={item.id} className={`gallery-upload-item is-${item.status}`}>
          <div className="gallery-upload-preview">
            {item.file.type.startsWith("image/")
              // A local object URL gives an immediate preview before private upload.
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={item.previewUrl} alt="" />
              : <video src={item.previewUrl} muted preload="metadata" />}
          </div>
          <div className="gallery-upload-fields">
            <strong>{item.file.name}</strong>
            <label><span>Title <em>optional</em></span><input value={item.title} maxLength={160} disabled={item.status !== "pending" && item.status !== "failed"} onChange={(event) => patch(item.id, { title: event.target.value })} /></label>
            <label><span>Caption <em>optional</em></span><textarea value={item.caption} maxLength={2000} rows={2} disabled={item.status !== "pending" && item.status !== "failed"} onChange={(event) => patch(item.id, { caption: event.target.value })} /></label>
            <div className="gallery-upload-status" role="status">
              <span>{item.status === "success" ? "Memory added" : item.status === "failed" ? item.error : item.status === "pending" ? "Ready" : item.status === "finalizing" ? "Securing memory…" : `${item.progress}%`}</span>
              {item.status === "uploading" || item.status === "finalizing" ? <i><b style={{ width: `${item.progress}%` }} /></i> : null}
            </div>
            <div>
              {item.status === "failed" ? <button type="button" onClick={() => void uploadOne(item.id)}>Retry</button> : null}
              {item.status !== "success" ? <button type="button" onClick={() => remove(item.id)}>{item.status === "preparing" || item.status === "uploading" || item.status === "finalizing" ? "Cancel" : "Remove"}</button> : <span className="gallery-upload-bloom" aria-hidden="true">✿</span>}
            </div>
          </div>
        </article>)}
      </div>
      <footer>
        <button type="button" onClick={onClose} disabled={busy}>Done</button>
        <button type="button" onClick={() => void startUploads()} disabled={!ready || busy}>{busy ? "Uploading…" : "Upload selected"}</button>
      </footer>
    </section>
  </div>;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelOurCornerVoiceUpload,
  finalizeOurCornerVoiceUpload,
  prepareOurCornerVoiceUpload,
} from "@/app/our-corner/actions";
import type { CornerMessageView } from "@/lib/our-corner/contracts";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { getPublicSupabaseConfig } from "@/lib/supabase/public-config";

type RecordingState = "idle" | "recording" | "paused" | "preview" | "uploading";

function supportedMime() {
  const choices = ["audio/webm", "audio/mp4", "audio/ogg"];
  return choices.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? "";
}

async function directUpload(url: string, blob: Blob, progress: (value: number) => void, signal: AbortSignal) {
  const config = getPublicSupabaseConfig();
  const { data: sessionData } = await createBrowserSupabaseClient().auth.getSession();
  return new Promise<void>((resolve, reject) => {
    if (!config) {
      reject(new Error("configuration"));
      return;
    }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal.addEventListener("abort", abort, { once: true });
    request.open("PUT", url);
    request.setRequestHeader("apikey", config.anonKey);
    request.setRequestHeader("Authorization", `Bearer ${sessionData.session?.access_token ?? config.anonKey}`);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      signal.removeEventListener("abort", abort);
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("upload"));
    };
    request.onerror = () => reject(new Error("upload"));
    request.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    const body = new FormData();
    body.append("cacheControl", "0");
    body.append("", blob, `voice-note.${blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : "webm"}`);
    request.send(body);
  });
}

export function CornerVoiceRecorder({ replyRef, onSent, onOptimistic, onFailed, onClose }: {
  replyRef?: string;
  onSent: (message: CornerMessageView) => void;
  onOptimistic?: (message: CornerMessageView) => void;
  onFailed?: (clientMessageId: string) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<RecordingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const elapsedBeforePause = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyserFrame = useRef<number | null>(null);
  const amplitude = useRef<number[]>([]);
  const uploadClientId = useRef("");

  const stopResources = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (analyserFrame.current) cancelAnimationFrame(analyserFrame.current);
    analyserFrame.current = null;
    void audioContext.current?.close();
    audioContext.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    stopResources();
  }, [stopResources]);

  const cancel = useCallback(() => {
    abort.current?.abort();
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    stopResources();
    setBlob(null);
    uploadClientId.current = "";
    setState("idle");
    onClose();
  }, [onClose, stopResources]);

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState !== "visible" && (state === "recording" || state === "paused")) cancel();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [cancel, state]);

  useEffect(() => () => {
    abort.current?.abort();
    stopResources();
  }, [stopResources]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const begin = async () => {
    if (state !== "idle") return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mime = supportedMime();
      const nextRecorder = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      recorder.current = nextRecorder;
      chunks.current = [];
      amplitude.current = [];
      nextRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      nextRecorder.onstop = () => {
        const recorded = new Blob(chunks.current, { type: nextRecorder.mimeType.split(";")[0] || "audio/webm" });
        if (!recorded.size) {
          setError("Nothing was recorded. Please try again.");
          setState("idle");
          return;
        }
        const url = URL.createObjectURL(recorded);
        setBlob(recorded);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return url;
        });
        setState("preview");
      };
      try {
        const context = new AudioContext();
        audioContext.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 64;
        context.createMediaStreamSource(media).connect(analyser);
        const values = new Uint8Array(analyser.frequencyBinCount);
        const sample = () => {
          analyser.getByteFrequencyData(values);
          const average = values.reduce((sum, value) => sum + value, 0) / values.length;
          amplitude.current.push(Math.max(8, Math.min(100, Math.round((average / 128) * 100))));
          analyserFrame.current = requestAnimationFrame(sample);
        };
        sample();
      } catch { /* Deterministic waveform fallback is created before upload. */ }
      nextRecorder.start(500);
      startedAt.current = Date.now();
      elapsedBeforePause.current = 0;
      setSeconds(0);
      setState("recording");
      timer.current = setInterval(() => {
        const elapsed = Math.floor((elapsedBeforePause.current + Date.now() - startedAt.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 600) stop();
      }, 250);
    } catch {
      setError("Microphone access was not granted. You can keep using text messages.");
    }
  };

  const pause = () => {
    if (recorder.current?.state !== "recording") return;
    recorder.current.pause();
    elapsedBeforePause.current += Date.now() - startedAt.current;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setState("paused");
  };

  const resume = () => {
    if (recorder.current?.state !== "paused") return;
    recorder.current.resume();
    startedAt.current = Date.now();
    setState("recording");
    timer.current = setInterval(() => {
      const elapsed = Math.floor((elapsedBeforePause.current + Date.now() - startedAt.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= 600) stop();
    }, 250);
  };

  const removePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setBlob(null);
    uploadClientId.current = "";
    setSeconds(0);
    setState("idle");
  };

  const send = async () => {
    if (!blob || state !== "preview") return;
    if (blob.size > 20 * 1024 * 1024 || seconds < 1 || seconds > 600) {
      setError("Voice notes must be under 10 minutes and 20 MB.");
      return;
    }
    setState("uploading");
    setProgress(0);
    setError("");
    const samples = amplitude.current.length
      ? Array.from({ length: 28 }, (_, index) => amplitude.current[Math.floor((index / 28) * amplitude.current.length)] ?? 20)
      : Array.from({ length: 28 }, (_, index) => 24 + ((index * 17) % 60));
    const clientMessageId = uploadClientId.current || crypto.randomUUID();
    uploadClientId.current = clientMessageId;
    onOptimistic?.({
      ref: `optimistic:${clientMessageId}`,
      clientMessageId,
      kind: "voice",
      body: null,
      senderLabel: "you",
      isOwn: true,
      reply: null,
      heartCount: 0,
      ownHeart: false,
      readByMe: true,
      readByOther: false,
      createdAt: new Date().toISOString(),
      editedAt: null,
      archivedAt: null,
      voice: { durationSeconds: Math.max(1, seconds), sizeBytes: blob.size, mimeType: blob.type, waveform: samples },
      shared: null,
    });
    const prepared = await prepareOurCornerVoiceUpload({
      clientMessageId,
      mimeType: blob.type,
      sizeBytes: blob.size,
      durationSeconds: Math.max(1, seconds),
      waveform: samples,
      replyRef,
    });
    if (!prepared.ok) {
      onFailed?.(clientMessageId);
      setError(prepared.error);
      setState("preview");
      return;
    }
    abort.current = new AbortController();
    try {
      await directUpload(prepared.signedUrl, blob, setProgress, abort.current.signal);
      const result = await finalizeOurCornerVoiceUpload(prepared.ticket);
      if (!result.ok) throw new Error(result.error);
      onSent(result.message);
      removePreview();
      onClose();
    } catch (reason) {
      await cancelOurCornerVoiceUpload(prepared.ticket);
      onFailed?.(clientMessageId);
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setError(reason instanceof Error ? reason.message : "The voice note could not be sent.");
      }
      setState("preview");
    } finally {
      abort.current = null;
    }
  };

  const display = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section className="corner-voice-recorder" aria-label="Voice note recorder">
      <header><strong>Voice note</strong><span aria-live="polite">{display}</span></header>
      {state === "idle" ? <button type="button" onClick={() => void begin()}>Start recording</button> : null}
      {state === "recording" ? <><span className="corner-recording-state">Recording</span><button type="button" onClick={pause}>Pause</button><button type="button" onClick={stop}>Stop</button></> : null}
      {state === "paused" ? <><span className="corner-recording-state">Paused</span><button type="button" onClick={resume}>Resume</button><button type="button" onClick={stop}>Stop</button></> : null}
      {state === "preview" && previewUrl ? <><audio controls src={previewUrl}>Your browser cannot preview this recording.</audio><button type="button" onClick={removePreview}>Delete</button><button type="button" onClick={() => void send()}>Send voice note</button></> : null}
      {state === "uploading" ? <progress aria-label="Voice upload progress" value={progress} max={100}>{progress}%</progress> : null}
      <button type="button" disabled={state === "uploading"} onClick={cancel}>Cancel</button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

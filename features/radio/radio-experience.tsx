"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { completeRadioJourney, deleteRadioTrack, recordRadioLocation, updateRadioTrack, uploadRadioTrack } from "@/app/radio/actions";
import { CelestialBackground } from "@/components/motion/celestial-background";
import { JourneyProgressMenu } from "@/features/progression/journey-progress-menu";
import { RoomCompletionPanel } from "@/features/progression/room-completion-panel";
import { audioExtension, audioFormats, MAX_AUDIO_SIZE, validateAudioFile, type PublicRadioTrack } from "@/lib/radio/tracks";

type Panel = { mode: "add" } | { mode: "edit"; track: PublicRadioTrack } | null;
type Progress = { storybook: boolean; library: boolean; puzzles: boolean; radio: boolean };

export function RadioExperience({ initialTracks, progress }: { initialTracks: PublicRadioTrack[]; progress: Progress }) {
  const reduceMotion = Boolean(useReducedMotion());
  const [tracks, setTracks] = useState(initialTracks);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const stopActiveRef = useRef<(() => void) | null>(null);
  const registerStop = useCallback((stop: () => void) => { stopActiveRef.current = stop; }, []);

  useEffect(() => { void recordRadioLocation(); }, []);

  const remove = async (track: PublicRadioTrack) => {
    if (deleting || !window.confirm(`Remove “${track.title}” and its private audio file? This cannot be undone.`)) return;
    setDeleting(track.id);
    if (activeId === track.id) stopActiveRef.current?.();
    const result = await deleteRadioTrack(track.id);
    if (result.ok) setTracks((items) => items.filter((item) => item.id !== track.id));
    setNotice(result.message ?? result.error ?? null);
    setDeleting(null);
  };

  return (
    <main className="radio-room">
      <CelestialBackground room="radio" moonProgress={1} />
      <div className="radio-ambient" aria-hidden="true"><i /><i /><i /><i /></div>
      <header className="radio-toolbar">
        <Link href="/?view=world">← Back to World</Link>
        <JourneyProgressMenu storybookCompleted libraryCompleted puzzleRoomCompleted radioCompleted={progress.radio} />
        <button type="button" onClick={() => setPanel({ mode: "add" })}>Add a song</button>
      </header>
      <motion.header className="radio-hero" initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <p>World 04 · Private listening room</p>
        <h1>Jessica’s Radio</h1>
        <span>A shared music library for songs you are authorised to keep inside this private world.</span>
      </motion.header>
      {notice ? <p className="radio-notice" role="status">{notice}</p> : null}
      <section className="radio-library" aria-labelledby="radio-library-title">
        <header><div><p>Shared private collection</p><h2 id="radio-library-title">Songs in the room</h2></div><span>{tracks.length} {tracks.length === 1 ? "song" : "songs"}</span></header>
        {tracks.length ? <div className="radio-track-grid">{tracks.map((track, index) => (
          <motion.article key={track.id} className={`radio-track-card ${activeId === track.id ? "is-playing" : ""}`} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : Math.min(index * .04, .24) }}>
            <div className="radio-cover" aria-hidden="true"><i /><span>♪</span></div>
            <div className="radio-track-copy"><p>{track.file_extension.toUpperCase()} · {formatBytes(track.size_bytes)}</p><h3>{track.title}</h3>{track.artist ? <strong>{track.artist}</strong> : null}{track.personal_note ? <blockquote>{track.personal_note}</blockquote> : null}<small>{track.uploader_label}</small></div>
            <div className="radio-track-actions">
              <button type="button" onClick={() => setActiveId(track.id)}>{activeId === track.id ? "Selected" : "Play"}</button>
              {track.is_uploader ? <><button type="button" onClick={() => setPanel({ mode: "edit", track })}>Edit</button><button type="button" disabled={deleting === track.id} onClick={() => void remove(track)}>{deleting === track.id ? "Removing…" : "Delete"}</button></> : null}
            </div>
          </motion.article>
        ))}</div> : <div className="radio-empty"><span aria-hidden="true">♫</span><h3>The room is quiet for now</h3><p>Add an authorised song whenever something belongs here. Nothing needs to be uploaded to continue.</p></div>}
      </section>
      <RadioPlayer tracks={tracks} requestedTrackId={activeId} onActiveChange={setActiveId} registerStop={registerStop} />
      <RadioJourneyPanel />
      <AnimatePresence>{panel ? <TrackPanel panel={panel} onClose={() => setPanel(null)} onSaved={(track, message) => {
        setTracks((items) => panel.mode === "add" ? [...items, track] : items.map((item) => item.id === track.id ? track : item));
        setNotice(message); setPanel(null);
      }} /> : null}</AnimatePresence>
    </main>
  );
}

function RadioPlayer({ tracks, requestedTrackId, onActiveChange, registerStop }: { tracks: PublicRadioTrack[]; requestedTrackId: string | null; onActiveChange: (id: string | null) => void; registerStop: (stop: () => void) => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<Promise<string> | null>(null);
  const urlCache = useRef(new Map<string, { url: string; expiresAt: number }>());
  const playLock = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(() => readPlayerPreference().volume);
  const [muted, setMuted] = useState(() => readPlayerPreference().muted);
  const [autoplayNext, setAutoplayNext] = useState(() => readPlayerPreference().autoplayNext);
  const activeIndex = Math.max(0, tracks.findIndex((track) => track.id === requestedTrackId));
  const active = requestedTrackId ? tracks.find((track) => track.id === requestedTrackId) ?? null : null;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;
    const time = () => setCurrentTime(audio.currentTime);
    const metadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const ended = () => { setPlaying(false); };
    const failed = () => { setPlaying(false); setLoading(false); setError("This song could not be played just now."); };
    audio.addEventListener("timeupdate", time); audio.addEventListener("loadedmetadata", metadata); audio.addEventListener("ended", ended); audio.addEventListener("error", failed);
    registerStop(() => { audio.pause(); audio.removeAttribute("src"); audio.load(); setPlaying(false); });
    return () => { audio.pause(); audio.removeAttribute("src"); audio.load(); audio.removeEventListener("timeupdate", time); audio.removeEventListener("loadedmetadata", metadata); audio.removeEventListener("ended", ended); audio.removeEventListener("error", failed); };
  }, [registerStop]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume; audioRef.current.muted = muted;
    localStorage.setItem("maybe-radio-player", JSON.stringify({ volume, muted, autoplayNext }));
  }, [volume, muted, autoplayNext]);

  const accessUrl = async (id: string) => {
    const cached = urlCache.current.get(id);
    if (cached && cached.expiresAt > Date.now() + 10_000) return cached.url;
    if (requestRef.current) return requestRef.current;
    requestRef.current = fetch(`/radio/tracks/${id}/access`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("access");
      const result = await response.json() as { url: string; expiresIn: number };
      urlCache.current.set(id, { url: result.url, expiresAt: Date.now() + result.expiresIn * 1000 });
      return result.url;
    }).finally(() => { requestRef.current = null; });
    return requestRef.current;
  };

  const play = async (track = active) => {
    if (!track || !audioRef.current || playLock.current) return;
    playLock.current = true; setLoading(true); setError(null);
    try {
      if (requestedTrackId !== track.id) onActiveChange(track.id);
      const url = await accessUrl(track.id);
      if (audioRef.current.src !== url) { audioRef.current.src = url; audioRef.current.load(); }
      await audioRef.current.play(); setPlaying(true);
    } catch { setError("Playback access could not be prepared. Please try again."); }
    finally { setLoading(false); playLock.current = false; }
  };
  const move = (direction: -1 | 1) => {
    if (!tracks.length) return;
    audioRef.current?.pause(); setPlaying(false); setCurrentTime(0);
    const next = (activeIndex + direction + tracks.length) % tracks.length;
    onActiveChange(tracks[next].id);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const ended = () => { if (autoplayNext && tracks.length > 1) { const next = tracks[(activeIndex + 1) % tracks.length]; onActiveChange(next.id); void play(next); } };
    audio.addEventListener("ended", ended);
    return () => audio.removeEventListener("ended", ended);
  });

  return <section className="radio-player" aria-label="Radio player" aria-busy={loading}>
    <div className="radio-now"><span aria-hidden="true">◉</span><div><small>{active ? "Now selected" : "Choose a song"}</small><strong>{active?.title ?? "The room is waiting"}</strong>{active?.artist ? <p>{active.artist}</p> : null}</div></div>
    <div className="radio-player-main">
      <div className="radio-transport"><button onClick={() => move(-1)} disabled={!tracks.length} aria-label="Previous song">‹</button><button onClick={() => playing ? (audioRef.current?.pause(), setPlaying(false)) : void play()} disabled={!active || loading} aria-label={playing ? "Pause" : "Play"}>{loading ? "…" : playing ? "Ⅱ" : "▶"}</button><button onClick={() => move(1)} disabled={!tracks.length} aria-label="Next song">›</button></div>
      <div className="radio-timeline"><span>{formatTime(currentTime)}</span><input type="range" min={0} max={duration || 0} value={Math.min(currentTime, duration || 0)} aria-label="Seek through song" aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} /><span>{formatTime(duration)}</span></div>
      <div className="radio-volume"><button type="button" aria-pressed={muted} onClick={() => setMuted((value) => !value)}>{muted ? "Unmute" : "Mute"}</button><input type="range" min={0} max={1} step={.05} value={volume} aria-label="Volume" aria-valuetext={`${Math.round(volume * 100)} percent`} onChange={(event) => setVolume(Number(event.target.value))} /></div>
      <label className="radio-autoplay"><input type="checkbox" checked={autoplayNext} onChange={(event) => setAutoplayNext(event.target.checked)} /> Autoplay next</label>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    <p className="sr-only" aria-live="polite">{active ? `${active.title} selected` : ""}</p>
  </section>;
}

function TrackPanel({ panel, onClose, onSaved }: { panel: Exclude<Panel, null>; onClose: () => void; onSaved: (track: PublicRadioTrack, message: string) => void }) {
  const reduceMotion = Boolean(useReducedMotion());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const lock = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === "Escape" && !lock.current) onClose(); }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); }, [onClose]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setSubmitting(true); setError(null);
    const result = panel.mode === "add" ? await uploadRadioTrack(new FormData(event.currentTarget)) : await updateRadioTrack(new FormData(event.currentTarget));
    lock.current = false; setSubmitting(false);
    if (result.ok && result.track) onSaved(result.track, result.message ?? "Radio updated.");
    else setError(result.error ?? "The Radio could not be updated.");
  };
  return <motion.div className="radio-panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <motion.aside className="radio-track-panel" role="dialog" aria-modal="true" aria-labelledby="radio-panel-title" initial={reduceMotion ? false : { x: "100%" }} animate={{ x: 0 }} exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}>
      <header><div><p>{panel.mode === "add" ? "Private shared upload" : "Your upload"}</p><h2 id="radio-panel-title">{panel.mode === "add" ? "Add a song" : "Edit song"}</h2></div><button ref={closeRef} type="button" onClick={onClose} disabled={submitting} aria-label="Close">×</button></header>
      <form onSubmit={submit}>
        {panel.mode === "edit" ? <input type="hidden" name="id" value={panel.track.id} /> : <label className="radio-file-field"><span>Audio file</span><input type="file" name="file" required accept=".mp3,.m4a,.aac,.wav,.ogg,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg" onChange={async (event) => {
          const file = event.currentTarget.files?.[0]; setError(null); setSummary(null); if (!file) return;
          const ext = audioExtension(file.name);
          if (!ext || file.size === 0 || file.size > MAX_AUDIO_SIZE || !(audioFormats[ext].mimes as readonly string[]).includes(file.type)) { setError(file.size > MAX_AUDIO_SIZE ? "Songs must be 50 MB or smaller." : "Choose a matching MP3, M4A, AAC, WAV, or OGG file."); return; }
          const valid = await validateAudioFile(file); if (!valid.ok) setError(valid.error); else setSummary(`${file.name} · ${audioFormats[valid.extension].label} · ${formatBytes(file.size)}`);
        }} /><small>MP3, M4A, AAC, WAV or OGG · Maximum 50 MB</small>{summary ? <strong>{summary}</strong> : null}</label>}
        <label><span>Song title</span><input name="title" required maxLength={160} defaultValue={panel.mode === "edit" ? panel.track.title : ""} /></label>
        <label><span>Artist <small>Optional</small></span><input name="artist" maxLength={160} defaultValue={panel.mode === "edit" ? panel.track.artist ?? "" : ""} /></label>
        <label><span>Personal note <small>Optional</small></span><textarea name="personal_note" maxLength={2000} rows={4} defaultValue={panel.mode === "edit" ? panel.track.personal_note ?? "" : ""} /></label>
        {error ? <p role="alert">{error}</p> : null}
        {submitting ? <div className="radio-upload-progress"><span /></div> : null}
        <div><button type="button" onClick={onClose} disabled={submitting}>Cancel</button><button type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? panel.mode === "add" ? "Uploading…" : "Saving…" : panel.mode === "add" ? "Add to Radio" : "Save changes"}</button></div>
      </form>
    </motion.aside>
  </motion.div>;
}

function RadioJourneyPanel() {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return <RoomCompletionPanel title="Ready for the next part?" message="This music library will stay open for every favourite song and shared discovery. You do not need to upload or play anything before continuing." primary={<button type="button" disabled={pending} aria-busy={pending} onClick={() => {
    if (lock.current) return; lock.current = true; setError(null); startTransition(async () => { const result = await completeRadioJourney(); if (result.ok) { router.push("/?view=world"); router.refresh(); } else { lock.current = false; setError(result.error); } });
  }}>{pending ? "Continuing…" : "Continue the journey"}</button>}>{error ? <p role="alert">{error}</p> : null}</RoomCompletionPanel>;
}

function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function formatTime(seconds: number) { if (!Number.isFinite(seconds)) return "0:00"; return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`; }
function readPlayerPreference() {
  const fallback = { volume: .65, muted: false, autoplayNext: false };
  if (typeof window === "undefined") return fallback;
  try {
    const value = JSON.parse(window.localStorage.getItem("maybe-radio-player") ?? "{}") as Partial<typeof fallback>;
    return {
      volume: typeof value.volume === "number" && value.volume >= 0 && value.volume <= 1 ? value.volume : fallback.volume,
      muted: typeof value.muted === "boolean" ? value.muted : fallback.muted,
      autoplayNext: typeof value.autoplayNext === "boolean" ? value.autoplayNext : fallback.autoplayNext,
    };
  } catch { return fallback; }
}

"use client";

import { useEffect, useRef, useState } from "react";
import { getOurCornerVoiceUrl } from "@/app/our-corner/actions";
import type { CornerMessageView } from "@/lib/our-corner/contracts";

const signedCache = new Map<string, { url: string; expiresAt: number }>();
const STOP_AUDIO_EVENT = "our-corner-stop-audio";

export function CornerVoicePlayer({ message }: { message: CornerMessageView }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");
  const voice = message.voice;

  useEffect(() => {
    const player = audio.current;
    const stop = (event: Event) => {
      const except = (event as CustomEvent<string>).detail;
      if (except !== message.ref) {
        player?.pause();
        setPlaying(false);
      }
    };
    const hidden = () => {
      if (document.visibilityState !== "visible") player?.pause();
    };
    window.addEventListener(STOP_AUDIO_EVENT, stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener(STOP_AUDIO_EVENT, stop);
      document.removeEventListener("visibilitychange", hidden);
      player?.pause();
    };
  }, [message.ref]);

  if (!voice) return null;

  const ensureUrl = async () => {
    const cached = signedCache.get(message.ref);
    if (cached && cached.expiresAt > Date.now() + 5000) return cached.url;
    const result = await getOurCornerVoiceUrl(message.ref);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    signedCache.set(message.ref, { url: result.signedUrl, expiresAt: new Date(result.expiresAt).getTime() });
    return result.signedUrl;
  };

  const toggle = async () => {
    const player = audio.current;
    if (!player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    setError("");
    const url = await ensureUrl();
    if (!url) return;
    window.dispatchEvent(new CustomEvent(STOP_AUDIO_EVENT, { detail: message.ref }));
    if (player.src !== url) player.src = url;
    player.playbackRate = speed;
    try {
      await player.play();
    } catch {
      setError("This voice note could not be played.");
    }
  };

  return (
    <div className={`corner-voice-player ${playing ? "is-playing" : ""}`}>
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
      />
      <button type="button" aria-label={playing ? "Pause voice note" : "Play voice note"} onClick={() => void toggle()}>{playing ? "Pause" : "Play"}</button>
      <div className="corner-waveform" aria-hidden="true">{voice.waveform.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
      <input
        type="range"
        min={0}
        max={voice.durationSeconds}
        step={0.1}
        value={Math.min(current, voice.durationSeconds)}
        aria-label="Voice note position"
        onChange={(event) => {
          const value = Number(event.target.value);
          setCurrent(value);
          if (audio.current) audio.current.currentTime = value;
        }}
      />
      <span>{Math.floor(current / 60)}:{String(Math.floor(current % 60)).padStart(2, "0")} / {Math.floor(voice.durationSeconds / 60)}:{String(voice.durationSeconds % 60).padStart(2, "0")}</span>
      <button
        type="button"
        aria-label={`Playback speed ${speed} times`}
        onClick={() => {
          const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
          setSpeed(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
      >{speed}×</button>
      {error ? <small role="alert">{error}</small> : null}
    </div>
  );
}

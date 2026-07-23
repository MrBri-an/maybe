"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const STORAGE_KEY = "maybe-storybook-page";
const SOUND_STORAGE_KEY = "maybe-storybook-sound";

type StoryPage = {
  title: string;
  eyebrow: string;
  body: string;
  status?: "written" | "waiting";
};

type Flip = {
  id: number;
  from: number;
  to: number;
  direction: 1 | -1;
  jump: boolean;
};

const storyPages: StoryPage[] = [
  { eyebrow: "The Screenshot", title: "An Ordinary Evening", body: "One evening, I was using my laptop when your profile appeared.", status: "written" },
  { eyebrow: "The Screenshot", title: "Then I Saw You", body: "I looked through your profile and immediately thought: you are exactly my kind of person.", status: "written" },
  { eyebrow: "The Screenshot", title: "My Kind of Person", body: "Your style caught my attention. Then your smile made sure I stayed.", status: "written" },
  { eyebrow: "The Screenshot", title: "The Screenshot", body: "I did not want to lose your profile before I could message you properly, so I took a screenshot.", status: "written" },
  { eyebrow: "The Screenshot", title: "Snapchat Snitched", body: "What I did not know was that Snapchat had absolutely no intention of keeping my secret.", status: "written" },
  { eyebrow: "The Screenshot", title: "Caught Red-Handed", body: "The notification reached you. Then your message reached me. I had to explain myself.", status: "written" },
  { eyebrow: "We Kept Talking", title: "The Explanation", body: "That awkward little explanation became a conversation.", status: "written" },
  { eyebrow: "We Kept Talking", title: "And Then We Talked", body: "We started talking, learning small things about each other, and somehow the conversation kept going.", status: "written" },
  { eyebrow: "We Kept Talking", title: "A Nice Little Journey", body: "It has been a really nice journey so far, even when you can be annoying sometimes.", status: "written" },
  { eyebrow: "We Kept Talking", title: "The Offline Queen", body: "One thing about you: you are definitely not always online.", status: "written" },
  { eyebrow: "We Kept Talking", title: "Sleep Comes First", body: "You would sometimes rather sleep, watch a movie, or simply do something away from your phone.", status: "written" },
  { eyebrow: "We Kept Talking", title: "Honestly, I Like That", body: "In a world where almost everyone is attached to a screen, I like that you know how to step away and live.", status: "written" },
  { eyebrow: "The Things I Know", title: "The Last Born", body: "You are the last born. An important piece of Jessica knowledge that probably explains a few things.", status: "written" },
  { eyebrow: "The Things I Know", title: "Then Came Luna", body: "And now there is Luna, your new dog, adding one more little character to your world.", status: "written" },
  { eyebrow: "The Things I Know", title: "Final Year", body: "You are in your final year, carrying school stress while trying to reach the finish line.", status: "written" },
  { eyebrow: "The Things I Know", title: "The Water Struggle", body: "Some days, that means walking a long distance just to get water when there is none at the lodge.", status: "written" },
  { eyebrow: "The Things I Know", title: "Uninvited Roommates", body: "Some nights, mosquitoes behave as though they also paid rent.", status: "written" },
  { eyebrow: "The Things I Know", title: "No Light Again", body: "Sometimes there is no electricity, making something as simple as charging your phone stressful.", status: "written" },
  { eyebrow: "The Things I Know", title: "Almost There", body: "I cannot wait for you to finish school, breathe, rest, and finally feel some of that pressure leave your shoulders.", status: "written" },
  { eyebrow: "The Things I Admire", title: "Your Music", body: "I love your taste in music. It makes me curious about the songs that feel most like you.", status: "written" },
  { eyebrow: "The Things I Admire", title: "Your Movies", body: "I love your taste in movies too—the stories you choose and the worlds you enjoy entering.", status: "written" },
  { eyebrow: "The Things I Admire", title: "Your Faith", body: "And I love the way you love God. That part of you genuinely matters to me.", status: "written" },
  { eyebrow: "The Things I Admire", title: "Your Smile", body: "There is your smile—the first thing that made a profile feel like more than just another profile.", status: "written" },
  { eyebrow: "The Things I Admire", title: "Your Style", body: "There is your style—the way you dress and somehow look completely like yourself.", status: "written" },
  { eyebrow: "The Things I Admire", title: "My Princess", body: "And there is you: the most beautiful princess in this little world I am building.", status: "written" },
  { eyebrow: "Maybe", title: "Talking to You", body: "I genuinely like talking to you. Even ordinary conversations feel worth showing up for.", status: "written" },
  { eyebrow: "Maybe", title: "I Know It Is Early", body: "I know we only just met. I know there is still so much about you for me to learn.", status: "written" },
  { eyebrow: "Maybe", title: "One Person", body: "But deep down, I can already imagine building a life with one person—growing, laughing, growing old, and doing crazy and beautiful things together.", status: "written" },
  { eyebrow: "Maybe", title: "Somehow, It Is You", body: "And somehow, whenever I imagine that one person, I imagine you.", status: "written" },
  { eyebrow: "Maybe", title: "The Beginning of Maybe", body: "All of this began because Snapchat gave me away. Maybe the screenshot was embarrassing. Maybe it was also the beginning of something worth writing slowly, one honest page at a time.", status: "written" },
];

function clampPage(value: number) {
  return Math.max(0, Math.min(storyPages.length - 1, value));
}

function spreadFor(page: number, desktop: boolean) {
  if (!desktop) return [clampPage(page)];
  const left = clampPage(page) - (clampPage(page) % 2);
  return [left, left + 1].filter((index) => index < storyPages.length);
}

function PageFace({ index, faceClass = "" }: { index: number; faceClass?: string }) {
  const item = storyPages[clampPage(index)];

  return (
    <article className={`storybook-page ${faceClass} ${item.status === "waiting" ? "is-waiting" : ""}`}>
      <p className="storybook-eyebrow">{item.eyebrow}</p>
      <h1>{item.title}</h1>
      <p className="storybook-body">{item.body}</p>
      {item.status === "waiting" ? <span className="storybook-writing-mark" aria-hidden="true">✦</span> : null}
      <footer><span>The Beginning of Maybe</span><b>{index + 1}</b></footer>
    </article>
  );
}

export function Storybook() {
  const reduceMotion = Boolean(useReducedMotion());
  const [page, setPage] = useState(0);
  const [desktopSpread, setDesktopSpread] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [flip, setFlip] = useState<Flip | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const flipping = useRef(false);
  const flipSequence = useRef(0);
  const flipFallback = useRef<number | null>(null);
  const touchStart = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const activeSound = useRef<Set<AudioScheduledSourceNode>>(new Set());
  const soundOnRef = useRef(true);

  const stopPageSound = useCallback(() => {
    activeSound.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source that has already ended needs no further cleanup.
      }
    });
    activeSound.current.clear();
  }, []);

  const playPageSound = useCallback((direction: 1 | -1, jump: boolean) => {
    if (!soundOnRef.current) return;

    try {
      stopPageSound();
      const context = audioContext.current ?? new AudioContext();
      audioContext.current = context;
      void context.resume();
      const now = context.currentTime;
      const duration = jump ? .42 : .82;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        const envelope = Math.sin(Math.PI * index / samples.length);
        samples[index] = (Math.random() * 2 - 1) * envelope;
      }

      const rustle = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const destination = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
      rustle.buffer = buffer;
      filter.type = "bandpass";
      filter.Q.value = .65;
      filter.frequency.setValueAtTime(direction > 0 ? 1850 : 1450, now);
      filter.frequency.exponentialRampToValueAtTime(direction > 0 ? 620 : 780, now + duration);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(jump ? .025 : .038, now + .07);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      rustle.connect(filter).connect(gain);
      if (destination) {
        destination.pan.setValueAtTime(direction > 0 ? .42 : -.42, now);
        destination.pan.linearRampToValueAtTime(direction > 0 ? -.34 : .34, now + duration);
        gain.connect(destination).connect(context.destination);
      } else {
        gain.connect(context.destination);
      }

      const landing = context.createOscillator();
      const landingGain = context.createGain();
      landing.type = "sine";
      landing.frequency.setValueAtTime(105, now + duration * .82);
      landing.frequency.exponentialRampToValueAtTime(72, now + duration);
      landingGain.gain.setValueAtTime(.0001, now);
      landingGain.gain.setValueAtTime(.012, now + duration * .82);
      landingGain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      landing.connect(landingGain).connect(context.destination);

      const removeSource = (source: AudioScheduledSourceNode) => {
        activeSound.current.delete(source);
      };
      rustle.onended = () => removeSource(rustle);
      landing.onended = () => removeSource(landing);
      activeSound.current.add(rustle);
      activeSound.current.add(landing);
      rustle.start(now);
      landing.start(now + duration * .82);
      landing.stop(now + duration + .02);
    } catch {
      // Story navigation must remain silent and functional without Web Audio.
    }
  }, [stopPageSound]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 48rem)");
    const updateMode = () => setDesktopSpread(query.matches);
    updateMode();
    query.addEventListener("change", updateMode);
    const saved = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) ?? "", 10);
    const savedSound = window.localStorage.getItem(SOUND_STORAGE_KEY);
    const resumeFrame = window.requestAnimationFrame(() => {
      if (Number.isFinite(saved)) setPage(clampPage(saved));
      if (savedSound === "muted") {
        soundOnRef.current = false;
        setSoundOn(false);
      }
    });
    return () => {
      query.removeEventListener("change", updateMode);
      window.cancelAnimationFrame(resumeFrame);
    };
  }, []);

  useEffect(() => () => {
    if (flipFallback.current !== null) window.clearTimeout(flipFallback.current);
    flipSequence.current += 1;
    flipping.current = false;
    stopPageSound();
    const context = audioContext.current;
    audioContext.current = null;
    if (context) void context.close();
  }, [stopPageSound]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(page));
  }, [page]);

  const releaseFlip = useCallback((id: number) => {
    if (!flipping.current || id !== flipSequence.current) return;
    if (flipFallback.current !== null) {
      window.clearTimeout(flipFallback.current);
      flipFallback.current = null;
    }
    flipping.current = false;
    setFlip((activeFlip) => activeFlip?.id === id ? null : activeFlip);
  }, []);

  const goTo = useCallback((target: number, jump = false) => {
    if (flipping.current) return;
    const currentSpread = spreadFor(page, desktopSpread);
    const normalizedTarget = desktopSpread ? clampPage(target) - (clampPage(target) % 2) : clampPage(target);
    const targetSpread = spreadFor(normalizedTarget, desktopSpread);
    if (currentSpread[0] === targetSpread[0]) {
      setContentsOpen(false);
      return;
    }

    flipping.current = true;
    const id = flipSequence.current + 1;
    flipSequence.current = id;
    setFlip({
      id,
      from: page,
      to: normalizedTarget,
      direction: normalizedTarget > currentSpread[0] ? 1 : -1,
      jump,
    });
    setPage(normalizedTarget);
    setContentsOpen(false);
    playPageSound(normalizedTarget > currentSpread[0] ? 1 : -1, jump);
    flipFallback.current = window.setTimeout(() => releaseFlip(id), jump ? 1000 : 1700);
  }, [desktopSpread, page, playPageSound, releaseFlip]);

  const visiblePages = spreadFor(page, desktopSpread);
  const firstVisible = visiblePages[0];
  const lastVisible = visiblePages[visiblePages.length - 1];
  const step = desktopSpread ? 2 : 1;
  const previous = useCallback(() => goTo(firstVisible - step), [firstVisible, goTo, step]);
  const next = useCallback(() => goTo(firstVisible + step), [firstVisible, goTo, step]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContentsOpen(false);
        return;
      }
      if (contentsOpen) return;
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contentsOpen, next, previous]);

  const progress = ((lastVisible + 1) / storyPages.length) * 100;
  const depthStyle = {
    "--read-depth": `${page / (storyPages.length - 1)}`,
    "--unread-depth": `${1 - page / (storyPages.length - 1)}`,
  } as CSSProperties;
  const oldSpread = flip ? spreadFor(flip.from, desktopSpread) : visiblePages;
  const newSpread = flip ? spreadFor(flip.to, desktopSpread) : visiblePages;
  const frontIndex = flip
    ? desktopSpread
      ? flip.direction > 0 ? oldSpread[oldSpread.length - 1] : oldSpread[0]
      : oldSpread[0]
    : firstVisible;
  const backIndex = flip
    ? desktopSpread
      ? flip.direction > 0 ? newSpread[0] : newSpread[newSpread.length - 1]
      : newSpread[0]
    : firstVisible;

  return (
    <main className="storybook-shell">
      <header className="storybook-toolbar">
        <Link className="storybook-world-link" href="/">← Back to world</Link>
        <button type="button" className="storybook-contents-button" onClick={() => setContentsOpen(true)} disabled={Boolean(flip)}>Table of contents</button>
        <button
          type="button"
          className="storybook-sound-button"
          aria-pressed={!soundOn}
          onClick={() => {
            const nextSoundOn = !soundOn;
            soundOnRef.current = nextSoundOn;
            setSoundOn(nextSoundOn);
            window.localStorage.setItem(SOUND_STORAGE_KEY, nextSoundOn ? "on" : "muted");
            if (!nextSoundOn) stopPageSound();
          }}
        >
          {soundOn ? "Sound on" : "Sound muted"}
        </button>
        <span>{firstVisible + 1}–{lastVisible + 1} of {storyPages.length}</span>
      </header>
      <div className="storybook-progress" aria-label={`${Math.round(progress)}% read`}><motion.span animate={{ width: `${progress}%` }} transition={{ duration: reduceMotion ? 0 : .45 }} /></div>
      <section
        className="storybook-stage"
        aria-label="Storybook"
        onTouchStart={(event) => { if (!flipping.current) touchStart.current = event.changedTouches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
          touchStart.current = null;
          if (Math.abs(distance) < 48) return;
          if (distance < 0) next();
          else previous();
        }}
      >
        <div className={`storybook-book ${desktopSpread ? "is-spread" : "is-single"} ${flip ? "is-flipping" : ""}`} style={depthStyle}>
          <div className="storybook-cover" aria-hidden="true" />
          <div className="storybook-page-stack storybook-page-stack-left" aria-hidden="true" />
          <div className="storybook-page-stack storybook-page-stack-right" aria-hidden="true" />
          <div className="storybook-pages">
            {visiblePages.map((index) => <PageFace index={index} key={index} />)}
          </div>
          <div className="storybook-spine-shadow" aria-hidden="true" />
          <div className="storybook-flip-viewport">
            <AnimatePresence>
              {flip ? (
                <motion.div
                className={`storybook-turning-leaf is-${flip.direction > 0 ? "next" : "previous"} ${flip.jump ? "is-jump" : ""}`}
                initial={reduceMotion ? { opacity: 1 } : { rotateY: 0, x: 0, z: 0, scaleX: 1 }}
                animate={reduceMotion
                  ? { opacity: 0 }
                  : {
                      rotateY: flip.direction > 0 ? [0, -13, -76, -145, -180, -178, -180] : [0, 13, 76, 145, 180, 178, 180],
                      x: flip.direction > 0 ? [0, 5, 2, -3, 0, 1, 0] : [0, -5, -2, 3, 0, -1, 0],
                      z: [0, 10, 24, 16, 0, 3, 0],
                      scaleX: [1, .99, .94, .965, 1, .995, 1],
                    }}
                transition={reduceMotion
                  ? { duration: .18 }
                  : { duration: flip.jump ? .52 : 1.02, ease: [0.42, 0, 0.18, 1], times: [0, .14, .42, .72, .9, .96, 1] }}
                onAnimationComplete={() => {
                  releaseFlip(flip.id);
                }}
              >
                <motion.div
                  className="storybook-leaf-curl"
                  initial={reduceMotion ? { opacity: 1 } : { skewY: 0, scaleX: 1, x: 0, z: 0 }}
                  animate={reduceMotion
                    ? { opacity: 0 }
                    : {
                        skewY: flip.direction > 0 ? [0, -1.7, .6, 0, -.18, 0] : [0, 1.7, -.6, 0, .18, 0],
                        scaleX: [1, .985, .925, .975, .995, 1],
                        x: flip.direction > 0 ? [0, 4, 1, -2, .7, 0] : [0, -4, -1, 2, -.7, 0],
                        z: [0, 9, 22, 10, 2, 0],
                      }}
                  transition={reduceMotion
                    ? { duration: .18 }
                    : { duration: flip.jump ? .48 : .96, times: [0, .18, .48, .76, .93, 1], ease: [0.33, 0, 0.2, 1] }}
                >
                  <div className="storybook-leaf-face storybook-leaf-front"><PageFace index={frontIndex} faceClass="is-turning-face" /></div>
                  <div className="storybook-leaf-face storybook-leaf-back"><PageFace index={backIndex} faceClass="is-turning-face" /></div>
                </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </section>
      <nav className="storybook-navigation" aria-label="Page navigation">
        <button type="button" onClick={previous} disabled={firstVisible === 0 || Boolean(flip)} aria-disabled={firstVisible === 0 || Boolean(flip)} aria-busy={Boolean(flip)}>Previous</button>
        <p>{desktopSpread ? "Use arrow keys or controls to turn the spread." : "Swipe, use arrow keys, or tap the controls."}</p>
        <button type="button" onClick={next} disabled={lastVisible === storyPages.length - 1 || Boolean(flip)} aria-disabled={lastVisible === storyPages.length - 1 || Boolean(flip)} aria-busy={Boolean(flip)}>Next</button>
      </nav>
      <AnimatePresence>
        {contentsOpen ? (
          <motion.div className="storybook-contents-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setContentsOpen(false)}>
            <motion.aside className="storybook-contents" role="dialog" aria-modal="true" aria-labelledby="contents-title" initial={reduceMotion ? false : { x: "100%" }} animate={{ x: 0 }} exit={reduceMotion ? { opacity: 0 } : { x: "100%" }} transition={{ duration: reduceMotion ? 0 : .4, ease: [0.22, 1, 0.36, 1] }} onClick={(event) => event.stopPropagation()}>
              <header><div><p>Thirty pages</p><h2 id="contents-title">Table of contents</h2></div><button type="button" onClick={() => setContentsOpen(false)} aria-label="Close table of contents">×</button></header>
              <ol>{storyPages.map((item, index) => <li key={index}><button type="button" onClick={() => goTo(index, true)} aria-current={visiblePages.includes(index) ? "page" : undefined}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong><small>{item.eyebrow}</small></button></li>)}</ol>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

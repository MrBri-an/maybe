"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";

const stars = Array.from({ length: 50 }, (_, index) => {
  const band = index % 5;
  const column = Math.floor(index / 5);

  return {
    left: 3 + column * 10 + ((band * 3 + column) % 5),
    top: 4 + band * 20 + ((column * 7 + band) % 9),
    size: 1 + ((index * 7) % 4),
    depth: index % 4,
    delay: (index % 11) * -0.72,
  };
});

type CelestialBackgroundProps = {
  moonProgress?: number;
  room?: "world" | "storybook" | "library" | "entrance";
};

export function CelestialBackground({ moonProgress = 0, room = "world" }: CelestialBackgroundProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const [visible, setVisible] = useState(true);
  const progress = Math.max(0, Math.min(1, moonProgress));
  const parallax = [
    { x: 1.25, y: -0.65 },
    { x: 2.1, y: -1.15 },
    { x: 3.15, y: -1.8 },
    { x: 4.5, y: -2.65 },
  ] as const;

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  return (
    <div className={`celestial-background celestial-room-${room} ${visible ? "" : "is-paused"}`} aria-hidden="true">
      <motion.div
        className="celestial-moon"
        animate={{ x: reduceMotion ? 0 : `${progress * 52}vw` }}
        transition={{ duration: reduceMotion ? 0 : 1.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="moon-halo moon-halo-outer" />
        <span className="moon-halo moon-halo-inner" />
        <span className="moon-disc"><i /><i /><i /></span>
      </motion.div>
      <div className="celestial-stars">
        {stars.map((star, index) => {
          const travel = parallax[star.depth];

          return (
          <motion.span
            key={index}
            className="celestial-star-path"
            animate={{
              x: reduceMotion ? 0 : `${progress * travel.x}vw`,
              y: reduceMotion ? 0 : `${progress * travel.y}vh`,
            }}
            transition={{ duration: reduceMotion ? 0 : 1.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
            }}
          >
            <i
              className={`celestial-star celestial-star-depth-${star.depth} ${index % 9 === 0 ? "celestial-star-twinkle" : ""}`}
              style={{
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              } as CSSProperties}
            />
          </motion.span>
          );
        })}
      </div>
      <div className="shooting-stars">
        <span className="shooting-star shooting-star-middle"><i /></span>
        <span className="shooting-star shooting-star-upper"><i /></span>
        <span className="shooting-star shooting-star-lower"><i /></span>
      </div>
      <div className="celestial-trails"><i /><i /><i /></div>
      <div className="celestial-particles">
        {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ "--particle-index": index } as CSSProperties} />)}
      </div>
    </div>
  );
}

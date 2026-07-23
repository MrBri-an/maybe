export type JourneyRoomState = "available" | "current" | "completed" | "locked" | "next" | "later";

export const JOURNEY_ROOMS = [
  { slug: "storybook", name: "Storybook", note: "Pages from the beginning", x: 50, y: 8 },
  { slug: "library", name: "Library", note: "A quiet reading room", x: 76, y: 17 },
  { slug: "puzzle-room", name: "Puzzle Room", note: "Small, forgiving curiosities", x: 91, y: 39 },
  { slug: "jessicas-radio", name: "Jessica’s Radio", note: "Songs chosen with care", x: 84, y: 68 },
  { slug: "question-garden", name: "Question Garden", note: "Thoughtful questions, always optional", x: 62, y: 88 },
  { slug: "gallery", name: "Gallery", note: "A few meaningful moments", x: 36, y: 88 },
  { slug: "our-journey", name: "Our Journey", note: "Only milestones that truly happen", x: 15, y: 68 },
  { slug: "maybe-days", name: "Maybe Days", note: "Gentle ideas for time together", x: 9, y: 39 },
  { slug: "our-corner", name: "Our Corner", note: "A calm private conversation space", x: 24, y: 17 },
  { slug: "open-when", name: "Open When", note: "Letters for another phase", x: 50, y: 30 },
] as const;

export const JOURNEY_ROOM_SLUGS = JOURNEY_ROOMS.map((room) => room.slug) as [
  (typeof JOURNEY_ROOMS)[number]["slug"],
  ...(typeof JOURNEY_ROOMS)[number]["slug"][],
];

export function getJourneyStates(storybookCompleted: boolean, libraryCompleted: boolean) {
  return {
    storybook: storybookCompleted ? "completed" : "current",
    library: libraryCompleted ? "completed" : storybookCompleted ? "current" : "locked",
    puzzleRoom: libraryCompleted ? "next" : storybookCompleted ? "locked" : "later",
    radio: "later",
    future: "later",
  } satisfies Record<string, JourneyRoomState>;
}

export function getJourneyRoomState(slug: (typeof JOURNEY_ROOMS)[number]["slug"], storybookCompleted: boolean, libraryCompleted: boolean): JourneyRoomState {
  const states = getJourneyStates(storybookCompleted, libraryCompleted);
  if (slug === "storybook") return states.storybook;
  if (slug === "library") return states.library;
  if (slug === "puzzle-room") return states.puzzleRoom;
  if (slug === "jessicas-radio") return states.radio;
  return states.future;
}

export function getJourneySummary(storybookCompleted: boolean, libraryCompleted: boolean) {
  if (libraryCompleted) return { message: "The next destination is being prepared", completed: 2 };
  if (storybookCompleted) return { message: "The Library is ready to explore", completed: 1 };
  return { message: "Begin with the Storybook", completed: 0 };
}

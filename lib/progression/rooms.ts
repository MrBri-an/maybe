export type JourneyRoomState = "available" | "current" | "completed" | "locked" | "next" | "later";

export const JOURNEY_ROOMS = [
  { slug: "storybook", name: "Storybook", note: "Pages from the beginning", x: 50, y: 8, route: "/story", implemented: true },
  { slug: "library", name: "Library", note: "A quiet reading room", x: 76, y: 17, route: "/library", implemented: true },
  { slug: "puzzle-room", name: "Puzzle Room", note: "Small, forgiving curiosities", x: 91, y: 39, route: "/puzzles", implemented: true },
  { slug: "jessicas-radio", name: "Jessica’s Radio", note: "Songs chosen with care", x: 84, y: 68, route: "/radio", implemented: true },
  { slug: "question-garden", name: "Question Garden", note: "Thoughtful questions, always optional", x: 62, y: 88, route: "/question-garden", implemented: true },
  { slug: "gallery", name: "Gallery", note: "A few meaningful moments", x: 36, y: 88, route: "/gallery", implemented: true },
  { slug: "our-journey", name: "Our Journey", note: "Only milestones that truly happen", x: 15, y: 68, route: null, implemented: false },
  { slug: "maybe-days", name: "Maybe Days", note: "Gentle ideas for time together", x: 9, y: 39, route: null, implemented: false },
  { slug: "our-corner", name: "Our Corner", note: "A calm private conversation space", x: 24, y: 17, route: null, implemented: false },
  { slug: "open-when", name: "Open When", note: "Letters for another phase", x: 50, y: 30, route: null, implemented: false },
] as const;

export const JOURNEY_ROOM_SLUGS = JOURNEY_ROOMS.map((room) => room.slug) as [
  (typeof JOURNEY_ROOMS)[number]["slug"],
  ...(typeof JOURNEY_ROOMS)[number]["slug"][],
];

export type JourneyRoomSlug = (typeof JOURNEY_ROOMS)[number]["slug"];
export type JourneyCompletion = {
  storybook: boolean;
  library: boolean;
  puzzleRoom: boolean;
  radio: boolean;
  questionGarden: boolean;
  gallery?: boolean;
};

function roomCompleted(slug: JourneyRoomSlug, completion: JourneyCompletion) {
  if (slug === "storybook") return completion.storybook;
  if (slug === "library") return completion.library;
  if (slug === "puzzle-room") return completion.puzzleRoom;
  if (slug === "jessicas-radio") return completion.radio;
  if (slug === "question-garden") return completion.questionGarden;
  if (slug === "gallery") return Boolean(completion.gallery);
  return false;
}

export function getJourneyNavigation(slug: JourneyRoomSlug, completion: JourneyCompletion) {
  const index = JOURNEY_ROOMS.findIndex((room) => room.slug === slug);
  const room = JOURNEY_ROOMS[index];
  const nextRoom = JOURNEY_ROOMS[index + 1] ?? null;
  const completed = roomCompleted(slug, completion);
  const nextImplemented = Boolean(nextRoom?.implemented && nextRoom.route);
  const nextUnlocked = completed && nextImplemented;
  return {
    room,
    completed,
    visitHref: room.implemented ? room.route : null,
    visitLabel: `Visit ${room.name}`,
    nextRoom,
    nextImplemented,
    nextUnlocked,
    nextHref: nextUnlocked ? nextRoom?.route ?? null : null,
    nextLabel: nextImplemented ? "Next" : "Next world coming later",
  };
}

export function getJourneyStates(storybookCompleted: boolean, libraryCompleted: boolean, puzzleRoomCompleted = false, radioCompleted = false, questionGardenCompleted = false, galleryCompleted = false) {
  return {
    storybook: storybookCompleted ? "completed" : "current",
    library: libraryCompleted ? "completed" : storybookCompleted ? "current" : "locked",
    puzzleRoom: puzzleRoomCompleted ? "completed" : libraryCompleted ? "current" : storybookCompleted ? "locked" : "later",
    radio: radioCompleted ? "completed" : puzzleRoomCompleted ? "current" : "later",
    questionGarden: questionGardenCompleted ? "completed" : radioCompleted ? "current" : "later",
    gallery: galleryCompleted ? "completed" : questionGardenCompleted ? "current" : "later",
    ourJourney: galleryCompleted ? "next" : "later",
    future: "later",
  } satisfies Record<string, JourneyRoomState>;
}

export function getJourneyRoomState(slug: (typeof JOURNEY_ROOMS)[number]["slug"], storybookCompleted: boolean, libraryCompleted: boolean, puzzleRoomCompleted = false, radioCompleted = false, questionGardenCompleted = false, galleryCompleted = false): JourneyRoomState {
  const states = getJourneyStates(storybookCompleted, libraryCompleted, puzzleRoomCompleted, radioCompleted, questionGardenCompleted, galleryCompleted);
  if (slug === "storybook") return states.storybook;
  if (slug === "library") return states.library;
  if (slug === "puzzle-room") return states.puzzleRoom;
  if (slug === "jessicas-radio") return states.radio;
  if (slug === "question-garden") return states.questionGarden;
  if (slug === "gallery") return states.gallery;
  if (slug === "our-journey") return states.ourJourney;
  return states.future;
}

export function getJourneySummary(storybookCompleted: boolean, libraryCompleted: boolean, puzzleRoomCompleted = false, radioCompleted = false, questionGardenCompleted = false, galleryCompleted = false) {
  if (galleryCompleted) return { message: "Our Journey is the next destination", completed: 6 };
  if (questionGardenCompleted) return { message: "The Gallery is ready to explore", completed: 5 };
  if (radioCompleted) return { message: "The Question Garden is ready to explore", completed: 4 };
  if (puzzleRoomCompleted) return { message: "Jessica’s Radio is ready to explore", completed: 3 };
  if (libraryCompleted) return { message: "The Puzzle Room is ready to explore", completed: 2 };
  if (storybookCompleted) return { message: "The Library is ready to explore", completed: 1 };
  return { message: "Begin with the Storybook", completed: 0 };
}

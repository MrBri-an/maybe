# The Beginning of Maybe

> A love story told through a world someone chose to build.

Some love stories begin with certainty. Others begin quietly—with two people, a growing connection, and the possibility that something meaningful may be starting.

**The Beginning of Maybe** is a private, interactive web experience about two people in love and a man who chooses not to merely promise her the world, but to begin building one for her.

The app unfolds like a story. Every room is a chapter. Every song, question, photograph, message, and shared activity reveals another part of the relationship. The journey ends with one private letter explaining why the world exists.

> This is my world to you. Maybe this is only the beginning.

## The Story

People often promise the world to someone they love.

Sometimes the promise is sincere. Sometimes it is beautiful. But a promise is still only a promise until it becomes effort, intention, consistency, and something real.

So he starts with what he has.

He uses design, code, music, stories, questions, memories, stars, and small personal ideas to create a digital world made for one person. It does not pretend the future is already written. It simply says:

- I am here.
- I am paying attention.
- I want to keep knowing you.
- You are worth the thought, time, and effort.

The world begins with a storybook and slowly opens into a library, a puzzle room, a radio, a garden of questions, a gallery, a universe, a jar of possible days, a private corner for two, and finally a sealed letter.

This is not just an application.

It is a story about two people, a possibility, and someone choosing to build something honest for the person he loves.

## The Ten Worlds

1. **Storybook**  
   The opening chapter: how the story began, what was noticed, and why the world was created.

2. **Library**  
   A quiet space for books, words, and ideas worth sharing.

3. **Puzzle Room**  
   Playful challenges that make entering the next part of the story feel personal and earned.

4. **Private Radio**  
   A shared music space where songs become part of the relationship.

5. **Question Garden**  
   A place where meaningful questions are planted, answered, and revealed between two people.

6. **Gallery**  
   A private home for photographs, videos, and visual memories.

7. **Her Universe**  
   A celestial world built around the qualities that make one person special.

8. **Maybe Days**  
   A jar of simple long-distance activities that can turn ordinary days into shared possibilities.

9. **Our Corner**  
   A private real-time room for messages, voice notes, moods, reactions, and quiet conversation.

10. **The Final Letter**  
    The emotional conclusion: one sealed letter explaining why the entire world was built.

## Development Journey

The project was created through fourteen reviewed phases. Each phase added one deliberate layer while preserving privacy, accessibility, security, and the continuity of the story.

### Phase 1 — Clean Project Foundation

Created the Next.js application shell, strict TypeScript setup, repository rules, environment safety, and the core project structure.

### Phase 2 — Design and Motion System

Established the visual language of the world: typography, spacing, colour, atmosphere, responsive behaviour, floating movement, and reduced-motion support.

### Phase 3 — Private Access Foundation

Introduced authenticated identities, approved membership, protected routes, secure server-side authorization, and the separation between romantic entrance gates and real security.

### Phase 4 — Opening Story and World Map

Built the opening experience and central world navigation, including room availability, progression, completion states, and the first complete view of the journey.

### Phase 5 — Animated Storybook

Created the full storybook experience with animated pages, responsive storytelling, progressive reveals, and the emotional beginning of the application.

### Phase 6 — Private Library and Persistent Progression

Added the private library, protected reading access, stored journey progress, resumable navigation, and direct continuation between worlds.

### Phase 7 — Puzzle Room

Built responsive quiz and puzzle challenges, secure answer handling, completion logic, and the playful transition into the shared parts of the world.

### Phase 8 — Private Radio

Created a shared private music library with protected tracks, playback controls, reactions, private storage, and a romantic radio atmosphere.

### Phase 9 — Question Garden

Added curated and custom questions, drafts, mutual reveals, reactions, shared answers, and a botanical interface where conversations can grow over time.

### Phase 10 — Gallery

Built a secure shared gallery for images and videos using private storage, short-lived signed access, direct uploads, previews, and an immersive media viewer.

### Phase 11 — Her Universe

Created a celestial experience of stars, planets, constellations, curated messages, and shared comments—an entire universe centred on one person.

### Phase 12 — Maybe Days

Added a shared jar containing fifty long-distance activities, atomic selection, shared progress, check-ins, comments, reactions, history, and a gentle opening animation.

### Phase 13 — Our Corner

Built a private real-time room for two with messages, replies, reactions, typing indicators, read receipts, voice notes, shared content, moods, and automatic day-and-night themes.

### Phase 14 — The Final Letter and Complete Journey

Completed the world with one private letter, author-only writing, secure sealing, recipient-only opening, an animated envelope, glowing stars, falling flowers, final progression, and the complete ten-world constellation.

## Core Experience

The application is designed around a few simple ideas:

- Every room should feel like part of one continuous love story.
- Both people keep separate identities, progress, messages, answers, and actions.
- Participation is optional; the journey never forces uploads, answers, messages, or activities.
- Completed worlds remain open so the story can continue growing.
- Animation should make the world feel alive without distracting from meaning.
- Private content belongs in protected services, never in the repository.
- The experience should remain beautiful and usable on both mobile and desktop.

## Technology

- **Framework:** Next.js App Router
- **Frontend:** React and TypeScript
- **Styling:** Tailwind CSS and scoped project CSS
- **Animation:** Motion and lightweight CSS animation
- **Backend:** Supabase PostgreSQL
- **Authentication:** Supabase Auth with approved private membership
- **Security:** Row Level Security and server-authorized mutations
- **Storage:** Private Supabase Storage with short-lived signed URLs
- **Realtime:** Supabase Realtime
- **Validation:** Zod, TypeScript, and ESLint
- **Deployment:** Vercel

## Privacy and Security

This repository contains the application—not the relationship's private content.

- Personal letters, messages, photographs, videos, songs, voice notes, answers, and private media must never be committed to Git.
- Private content is stored through protected Supabase services.
- Approved members retain separate authenticated identities.
- Row Level Security protects private database records.
- Private media uses controlled storage and short-lived signed URLs.
- Sensitive mutations are reauthorized on the server.
- Secrets belong only in local or deployment environment configuration.
- The application does not claim end-to-end encryption or screenshot prevention unless those protections are genuinely implemented.

## Project Principles

1. **Love shown through effort**  
   The world should feel intentionally made, not generic.

2. **Story before features**  
   Every interaction should support the emotional journey.

3. **Private by default**  
   Only the intended two people should be able to enter.

4. **Two people, two identities**  
   Progress, messages, answers, uploads, reactions, and private permissions must remain correctly attributed.

5. **Quiet, not crowded**  
   Motion should feel alive without making the experience difficult to read or use.

6. **Optional participation**  
   A person can continue without being forced to upload, answer, message, or perform.

7. **Accessible motion**  
   Every animated experience must remain understandable with reduced motion enabled.

8. **Mobile first**  
   Every world should work beautifully on a phone as well as a desktop.

9. **Honest security**  
   Privacy and technical capabilities must be described accurately.

10. **The worlds remain open**  
    Completion should never prevent either person from returning and creating new memories.

## Current Status

All fourteen planned phases and all ten worlds have been implemented.

The project remains under active testing and hardening, particularly around:

- private member provisioning
- trusted access flows
- live two-account authorization
- Row Level Security verification
- physical-device keyboard behaviour
- private media playback
- signed URL expiry
- accessibility across mobile browsers

## Required Reading

Before changing the repository, read these files completely and in order:

1. `AGENT.md`
2. `SECURITY.md`
3. `ARCHITECTURE.md`
4. `DESIGN.md`
5. The active approved phase or repair prompt

Treat those documents and the active task as authoritative.

## Local Development

Install the locked dependencies and start the development server:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful validation commands:

```bash
npm run lint
npm run typecheck
git diff --check
```

> Codex must not run `npm run build` or an equivalent production build unless a task explicitly authorizes it.

## Environment Safety

- Never commit `.env.local`.
- Never commit Supabase keys, tokens, password hashes, session secrets, private access links, or real credentials.
- Keep `.env.example` limited to placeholders and safe documentation.
- Never place personal media in `public/`.
- Never print private letter content, messages, emails, UUIDs, tokens, or secrets in logs.

## Development Workflow

Development follows one reviewed phase or repair at a time:

1. Read the authoritative project documents.
2. Inspect the existing implementation before changing it.
3. Implement only the approved scope.
4. Preserve privacy, RLS, member identity, and progression.
5. Run only the permitted checks.
6. Report exact files, behaviour, limitations, and Git status.
7. Stop before committing, pushing, deploying, migrating, or starting another phase unless explicitly instructed.

---

**The Beginning of Maybe** is a story about two people, a possibility, and one person choosing not only to promise a world—but to begin building one.

# AGENT.md

## Project

**The Beginning of Maybe** is a private, romantic, interactive web application created for Jessica.

The experience begins with the true story of how Brian and Jessica met on Snapchat. Jessica accepted Brian, he saw her profile while working, took a screenshot so he could message her later, Snapchat notified her, and his explanation became the beginning of their conversations.

The application will eventually include a cinematic opening, an interactive storybook, a private book library, easy puzzles, music, a gallery, a journey, a question experience, a shared activity calendar, private messaging, Open When letters, and future memories.

The product must feel personal, elegant, playful, private, and emotionally respectful.

## Mandatory Rule: Never Run a Production Build

Codex must never run:

```bash
npm run build
```

Codex must also never run an equivalent production build command, including:

```bash
next build
pnpm build
yarn build
bun run build
vite build
```

Do not use any script, tool, or command that automatically performs a production build.

This restriction remains active throughout the project unless Brian explicitly replaces it in writing.

## Required Reading Order

Before changing the repository, read:

1. `AGENT.md`
2. `SECURITY.md`
3. `ARCHITECTURE.md`
4. `DESIGN.md`
5. The active phase prompt
6. Existing files relevant to that phase

Instruction priority:

1. Current phase prompt
2. `AGENT.md`
3. `SECURITY.md`
4. `ARCHITECTURE.md`
5. `DESIGN.md`
6. Existing implementation

Security rules always override convenience and visual design.

## Strict Phase Workflow

1. Work on only one phase at a time.
2. Do not begin another phase automatically.
3. Do not implement future features early.
4. Do not silently expand scope.
5. Inspect the repository before editing.
6. Implement only the current phase requirements.
7. Run only safe checks relevant to the phase.
8. Stop when the current phase is complete.
9. Provide the required completion report.
10. Wait for Brian to review the report.
11. Continue only after receiving a new phase prompt.

## Repository Cleanliness

1. Keep the repository simple and organised.
2. Do not create unnecessary files or folders.
3. Do not leave temporary files, copied assets, logs, caches, screenshots, test videos, local databases, or generated output in the repository.
4. Do not create duplicate configuration files.
5. Do not introduce a second package manager.
6. Use the package manager selected during project creation consistently.
7. Do not add dependencies without a current phase requirement.
8. Remove unused dependencies only when their removal is safe and verified.
9. Do not keep multiple competing implementations of the same feature.
10. Preserve working behaviour unless the current phase explicitly changes it.
11. Keep `.gitignore` accurate as the project evolves.
12. Do not commit `.env.local`, personal media, private uploads, or local Supabase state.

## Code Quality

1. Use TypeScript strict mode.
2. Avoid `any` unless an unavoidable reason is documented.
3. Use explicit types for public interfaces and shared data.
4. Keep components focused and reusable.
5. Keep business logic outside visual components where practical.
6. Keep client and server responsibilities clearly separated.
7. Validate every untrusted input.
8. Handle loading, empty, success, offline, and error states.
9. Avoid duplicated business logic.
10. Avoid hidden global state.
11. Avoid unnecessary abstractions.
12. Prefer readable code over clever code.
13. Use clear, human readable naming.
14. Add comments only where important reasoning is not obvious.
15. Do not expose internal errors directly to users.
16. Do not log sensitive content.
17. Use server side authorization for protected operations.
18. Keep secrets and privileged keys on the server.
19. Clean up subscriptions, event listeners, timers, and object URLs.
20. Do not claim completion when important behaviour is untested.

## User Experience

1. Build mobile first.
2. Support desktop and tablet layouts.
3. Keep the experience smooth on ordinary mobile devices.
4. Respect `prefers-reduced-motion`.
5. Do not block navigation with decorative animation.
6. Allow long opening sequences to be skipped after first viewing.
7. Keep audio controls visible.
8. Never begin loud audio automatically.
9. Give Jessica control over play, pause, mute, answers, downloads, messages, and privacy.
10. Make puzzles easy, forgiving, and skippable.
11. Never trap the user inside a puzzle or story page.
12. Preserve progress where appropriate.
13. Avoid aggressive popups, pressure based copy, and manipulative countdowns.
14. Do not make the interface feel like a corporate dashboard.
15. Provide graceful fallbacks when advanced animation is unavailable.

## Accessibility

1. Use semantic HTML.
2. Support keyboard navigation.
3. Provide visible focus states.
4. Use accessible labels and descriptions.
5. Provide useful alt text for meaningful images.
6. Mark decorative visuals appropriately.
7. Maintain readable colour contrast.
8. Do not use colour as the only indicator.
9. Make touch targets large enough.
10. Provide button and keyboard alternatives for page flipping and drag interactions.
11. Test important flows without a mouse.
12. Preserve all information when reduced motion is active.
13. Avoid flashing effects that could trigger discomfort.
14. Announce important state changes when appropriate.
15. Do not hide essential controls behind hover only interactions.

## Personal Media Rules

Real images, music, books, voice notes, and chat files must not be added during the early build.

Until the approved media phase:

1. Do not create the real media folder.
2. Do not add Jessica's pictures.
3. Do not add private books.
4. Do not add real music files.
5. Do not add voice notes or chat media.
6. Use neutral placeholders only.
7. Do not place private files in `public/`.
8. Do not commit personal media to Git.
9. Do not embed private files as base64 in source code.
10. Do not hardcode permanent private media URLs.
11. Do not invent personal filenames.
12. Wait for the dedicated media phase prompt.

The intended local development structure will later be:

```text
media/
  private/
    images/
    music/
    books/
    voice-notes/
    chat/
  placeholders/
```

`media/private/` must remain ignored by Git. Production media must use private object storage rather than the repository.

## Content Rules

1. Keep the tone warm, playful, romantic, and honest.
2. Do not imply that Brian and Jessica are already in a committed relationship.
3. Do not fabricate real messages.
4. Do not present reconstructed dialogue as historical fact.
5. Do not use possessive, intrusive, or manipulative language.
6. Do not pressure Jessica to answer questions, choose activities, or continue the experience.
7. Do not automatically send her answers.
8. Do not collect hidden behavioural, location, contact, or device data.
9. Give Jessica clear control over what is shared.
10. The Snapchat scene must be an original reconstruction, not an exact copy of Snapchat's interface.
11. Future journey events must be added only when they genuinely happen.
12. Published books and music must be supplied or authorised by Brian.

## Security Rules

1. Follow `SECURITY.md` completely.
2. Never rely on client side authorization.
3. Never expose secrets to the browser.
4. Never expose a service role key to client code.
5. Never disable Row Level Security for convenience.
6. Never place sensitive data in logs.
7. Never make private storage buckets public.
8. Never allow unrestricted uploads.
9. Never use the romantic puzzle as the only security control.
10. Never treat obscurity as security.
11. Never commit `.env.local`.
12. Never place real credentials in `.env.example`.
13. Never hardcode an authentication bypass.
14. Never protect owner routes with client only checks.
15. Never claim end to end encryption unless it is genuinely implemented and reviewed.

## Approved Safe Checks

Codex may run relevant commands that already exist in the repository, such as:

```bash
npm run lint
npm run typecheck
npm test
npx tsc --noEmit
npx eslint .
npx vitest run
npx playwright test
```

If a command is unavailable, report that fact. Do not invent results.

## Required Phase Completion Report

At the end of every phase, report:

1. Phase name
2. Objective completed
3. Files created
4. Files changed
5. Files deleted
6. Dependencies added or removed
7. Database migrations added
8. Environment variables introduced
9. Checks and tests run
10. Exact results
11. Security decisions
12. Accessibility decisions
13. Known limitations
14. Deferred work
15. Risks or blockers
16. What the next phase may safely assume
17. Confirmation that `npm run build` was not run
18. Confirmation that no future phase was started

Stop after the report.

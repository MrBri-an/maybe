# The Beginning of Maybe

A private, carefully phased web experience created for Jessica.

**Current status:** Phase 1 foundation. This repository currently contains only the minimal application shell and its development configuration.

## Required reading

Before changing the repository, read these files completely and in order:

1. `AGENT.md`
2. `SECURITY.md`
3. `ARCHITECTURE.md`
4. `DESIGN.md`
5. The active phase prompt

Treat the active phase and these documents as authoritative.

## Local development

Use Node.js and npm. Install the locked dependencies, then start the development server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` while the development server is running.

## Safe commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
```

> **Codex must not run `npm run build` or any equivalent production build command.**

## Privacy and environment safety

- Do not add personal images, music, books, voice notes, video, chat attachments, or other private media until the approved media phase.
- Never place personal media in `public/` or commit it to Git.
- Never commit `.env.local` or real credentials.
- Keep `.env.example` free of secrets; add placeholders only when an approved phase introduces the corresponding service.

## Phase workflow

Development proceeds one reviewed phase at a time. Implement only the active phase, run only its permitted checks, provide its completion report, and stop. Do not begin a future phase without a new approved phase prompt.

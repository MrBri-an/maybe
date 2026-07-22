# ARCHITECTURE.md

## Purpose

This document defines the technical structure for The Beginning of Maybe.

The project will begin from a clean environment. Only `AGENT.md`, `SECURITY.md`, `DESIGN.md`, and `ARCHITECTURE.md` should exist before the first Codex build phase, apart from normal repository metadata.

Do not copy previous build packs into the clean repository.

The architecture must support phased development, invite only access, private media, rich interaction, secure data access, and future real time messaging.

## Recommended Stack

### Frontend

1. Next.js with App Router
2. React
3. TypeScript strict mode
4. Tailwind CSS
5. Motion for React
6. Accessible component primitives where needed
7. Zod for validation
8. React Hook Form only where a conventional form is appropriate

### Backend

1. Supabase Authentication
2. Supabase PostgreSQL
3. Supabase Row Level Security
4. Supabase private Storage
5. Supabase Realtime
6. Next.js Server Actions or Route Handlers for protected operations

### Testing

1. TypeScript compiler
2. ESLint
3. Vitest
4. Testing Library
5. Playwright for critical browser flows

Do not install all dependencies during project creation. Add a dependency only when the active phase requires it.

## Core Principles

1. Mobile first
2. Server authorised
3. Private by default
4. Feature based organisation
5. Progressive enhancement
6. Accessible without animation
7. Personal media outside Git
8. Strict phase implementation
9. Minimal data collection
10. Clear separation between romantic experience gates and real security

## Clean Project Foundation

The first phase may create:

```text
the-beginning-of-maybe/
  AGENT.md
  SECURITY.md
  DESIGN.md
  ARCHITECTURE.md
  .gitignore
  .env.example
  package.json
  next.config.ts
  tsconfig.json
  eslint.config.mjs
  app/
  components/
  features/
  lib/
  public/
  styles/
  tests/
```

Do not create personal media folders during the foundation phase.

## Target Source Structure

As features are approved, the repository may evolve toward:

```text
app/
  layout.tsx
  page.tsx
  globals.css

  access/
    page.tsx
  world/
    page.tsx
  story/
    page.tsx
    [page]/
      page.tsx
  library/
    page.tsx
    [bookId]/
      page.tsx
  puzzles/
    page.tsx
    [puzzleId]/
      page.tsx
  radio/
    page.tsx
  questions/
    page.tsx
  gallery/
    page.tsx
  journey/
    page.tsx
  maybe-days/
    page.tsx
  messages/
    page.tsx
  letters/
    page.tsx
  final/
    page.tsx

  brian/
    layout.tsx
    page.tsx
    books/
      page.tsx
    gallery/
      page.tsx
    music/
      page.tsx
    activities/
      page.tsx
    story/
      page.tsx
    security/
      page.tsx

  api/
    media/
    messages/
    notifications/

components/
  ui/
  layout/
  motion/
  feedback/
  media/

features/
  access/
  story/
  library/
  puzzles/
  radio/
  questions/
  gallery/
  journey/
  maybe-days/
  messaging/
  letters/
  admin/

lib/
  auth/
  database/
  storage/
  validation/
  security/
  notifications/
  time/
  constants/
  types/

content/
  story/
  questions/
  puzzles/
  activities/
  letters/

tests/
  unit/
  integration/
  e2e/
```

This is a target, not a command to create all folders immediately. Create only what the current phase needs.

## Route Model

### Public Surface

The application should expose very little publicly.

Possible public route:

```text
/
```

The root may show a private invitation entry. Avoid public indexing.

### Protected Routes

```text
/world
/story
/library
/puzzles
/radio
/questions
/gallery
/journey
/maybe-days
/messages
/letters
/final
```

### Owner Routes

```text
/brian
/brian/books
/brian/gallery
/brian/music
/brian/activities
/brian/story
/brian/security
```

All owner routes require server verified authorization. Hiding a link is not authorization.

## Authentication Flow

Recommended invite only flow:

1. Brian creates or approves Jessica's invitation.
2. Jessica receives a secure link or one time code.
3. Jessica completes real authentication.
4. The server confirms that the user is an approved app member.
5. The romantic puzzle appears as part of the experience.
6. Trusted authenticated sessions may remember completed entrance state.
7. Protected routes continue to verify authentication and membership.

Possible methods:

1. Email magic link
2. Email one time password
3. Invite based password flow

The exact method should be chosen during the authentication phase.

Do not create public registration.

## Authorization Layers

1. Route protection
2. Server Action and Route Handler checks
3. Row Level Security
4. Storage policies
5. Owner role checks
6. Conversation membership checks
7. Object ownership checks

Client state may improve the interface but must never be the authorization source of truth.

## Data Domains

### Identity

```text
profiles
app_members
trusted_sessions
```

### Experience Progress

```text
story_progress
puzzle_progress
section_progress
```

### Content

```text
books
songs
playlists
playlist_items
gallery_items
questions
journey_events
open_when_letters
```

### Responses

```text
question_answers
calendar_activities
activity_responses
```

### Messaging

```text
conversations
conversation_members
messages
message_attachments
```

### Operations

```text
notifications
security_events
```

Introduce each table only when its phase needs it. Every private table requires Row Level Security before use.

## Static Content

Original story content should be separate from application logic.

Possible structure:

```text
content/story/manifest.json
content/story/pages/01.mdx
content/story/pages/02.mdx
```

or typed TypeScript content files.

The story content system must support:

1. Approximately 30 pages
2. Text pages
3. Illustration references
4. Puzzle references
5. Music references
6. Page transitions
7. Table of contents
8. Downloadable original edition later
9. Indirect media references
10. No embedded private files

Choose the final content method during the story phase.

## Media Architecture

The media system must remain private and clean. It will be introduced in a dedicated development phase with direct guidance for Brian.

### Local Development Structure

When the media phase begins, create:

```text
media/
  private/
    images/
      gallery/
      story/
      profiles/
    music/
    books/
    voice-notes/
    chat/
      images/
      videos/
      files/
  placeholders/
    images/
    audio/
    books/
```

Before creating it, add:

```gitignore
media/private/
media/imports/
media/temp/
```

`media/placeholders/` may be committed only when it contains neutral nonpersonal assets.

### Purpose of the Local Media Folder

Use it for:

1. Organising files before upload
2. Controlled import testing
3. Checking filenames and metadata
4. Preparing thumbnails
5. Temporary development use

It is not the production delivery system and must not be served directly.

### Production Storage

Use private Supabase Storage buckets:

```text
private-books
private-gallery
private-music
private-voice-notes
private-chat-media
```

Store metadata such as:

```text
id
bucket
object_path
owner_id
category
mime_type
size_bytes
title
description
download_allowed
created_at
updated_at
```

Do not store permanent signed URLs. Generate temporary access only after authorization.

### Owner Import Workflow

The final owner experience should allow Brian to:

1. Select a file
2. Choose its category
3. Add title and description
4. Decide whether download is allowed
5. Upload to the correct private bucket
6. Create a metadata record
7. Preview the result
8. Replace or remove the file
9. Revoke access

Do not create the media folder before the dedicated phase prompt.

## Storybook Architecture

Required capabilities:

1. Page manifest
2. Page renderer
3. Page navigation
4. Progress persistence
5. Reduced motion fallback
6. Interactive page support
7. Puzzle integration
8. Mobile reading mode
9. Optional downloadable original edition

Suggested component boundaries:

```text
StoryBook
StoryPage
StoryPageRenderer
StoryNavigation
StoryProgress
StoryPuzzleSlot
StoryMediaSlot
```

Do not couple the page content tightly to a single page flip library. Keep transition logic replaceable.

## Library Architecture

Support:

1. PDF
2. EPUB
3. External legal links
4. Download permission
5. Reading status
6. Personal notes
7. Cover image
8. Metadata

Provide embedded reading where supported, a secure open action, download only when permitted, and a helpful unsupported format state.

Books supplied by Brian must be uploaded privately.

## Puzzle Engine

Possible puzzle types:

```text
sequence
multiple_choice
hidden_object
connect_points
memory_match
image_tiles
sentence_completion
path_choice
```

Suggested model:

```text
id
slug
type
title
instructions
difficulty
hint
content
reward
skippable
active
```

The engine should support progress, hints, skip, retry, completion, accessible alternatives, reduced motion, and reward unlocks.

Do not create every puzzle as unrelated hardcoded logic unless there is a strong reason.

## Music Architecture

Support source types:

```text
private_audio
streaming_embed
external_link
```

Suggested metadata:

```text
id
title
artist
source_type
source_reference
cover_reference
note
playlist_id
position
active
```

Audio state may use a dedicated provider. It must support play, pause, seek, volume, mute, queue, previous, next, background preference, browser autoplay rules, and stopping on logout.

Do not store copyrighted audio in Git.

## Question Architecture

Question records may include:

```text
id
prompt
category
display_type
visual_object
position
active
```

Answer records may include:

```text
id
question_id
author_id
answer
status
shared_with_brian
created_at
updated_at
```

Possible status:

```text
draft
private
shared
```

Never send a draft automatically.

## Gallery Architecture

Possible fields:

```text
id
media_reference
caption
taken_at
position
visible
download_allowed
created_by
```

Use optimised derivatives and avoid exposing original images unnecessarily.

## Journey Architecture

Possible fields:

```text
id
title
description
event_date
event_type
media_reference
position
visible
```

Do not invent dates. Allow an event without a precise date when necessary.

## Maybe Days Architecture

Activity fields may include:

```text
id
title
description
proposed_start
duration_minutes
brian_timezone
jessica_timezone
status
created_by
```

Response fields may include:

```text
id
activity_id
user_id
response
suggested_start
message
created_at
```

Use IANA time zones, store timestamps in UTC, and render local time at the interface boundary.

## Messaging Architecture

Implement messaging only after authentication, authorization, database policies, and storage policies are stable.

Use:

```text
conversations
conversation_members
messages
message_attachments
```

Possible structured message types:

```text
text
image
video
voice
song
question
activity
memory
system
```

Do not render arbitrary HTML. Validate every structured payload.

Supabase Realtime may support new messages, updates, typing state, delivery state, and activity changes. Keep typing state ephemeral where possible and do not preserve unnecessary presence history.

## Notifications

Support in application notifications and limited email notifications.

Safe email examples:

1. Jessica answered a question.
2. A new message is waiting.
3. A Maybe Day response was received.

Do not include full answers, private messages, images, or signed media links in email.

## Brian Studio

The owner only management area may support:

1. Uploading books
2. Uploading gallery media
3. Adding songs
4. Editing story content
5. Adding questions
6. Adding activities
7. Adding journey events
8. Creating letters
9. Reviewing access
10. Revoking sessions
11. Reviewing safe security events

All privileged operations require server side authorization. Never expose service role actions directly to the browser.

## State Management

Prefer server data and local component state.

Use shared client state only for clear needs such as:

1. Audio player
2. Reduced motion preference
3. Navigation state
4. Temporary puzzle session
5. Toasts

Do not place broad private server data in an unnecessary global client store.

## Error Model

Define clear typed categories:

1. Authentication required
2. Access denied
3. Validation failed
4. Media unavailable
5. Upload rejected
6. Network unavailable
7. Rate limited
8. Not found
9. Unexpected server error

User messages should be gentle and useful. Technical details belong in controlled server logs.

## Environment Configuration

Create `.env.example` only when the relevant phase requires it.

Likely variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_BASE_URL=
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=
```

Real values belong in `.env.local`. Add only variables actually used by the current implementation.

## Testing Architecture

### Unit Tests

Use for validation, puzzle logic, time zone conversion, permission helpers, content parsing, and media metadata rules.

### Integration Tests

Use for Server Actions, database access, authorization, upload validation, message creation, and activity responses.

### Browser Tests

Use for private entrance, authentication, story navigation, puzzle completion, music controls, question sharing consent, calendar responses, messaging, logout, and unauthorised route access.

Physical device checks remain necessary before release.

## Performance

1. Use server rendering where appropriate.
2. Keep highly interactive sections client side only where needed.
3. Dynamically load heavy animation modules.
4. Optimise images.
5. Lazy load private media.
6. Paginate or virtualise long message histories.
7. Avoid loading entire books into memory.
8. Pause hidden animation.
9. Avoid excessive Realtime subscriptions.
10. Clean up subscriptions.
11. Do not cache signed URLs beyond their safe lifetime.
12. Keep the first interaction responsive.

## Deployment Direction

The project may later use GitHub, Vercel, and Supabase.

Before release:

1. Confirm private assets are absent from Git history.
2. Confirm environment variables.
3. Confirm database policies.
4. Confirm storage policies.
5. Confirm allowed origins.
6. Confirm security headers.
7. Confirm indexing restrictions.
8. Remove test accounts, debug routes, and secrets.
9. Complete accessibility and physical device checks.
10. Complete a release checklist.

Codex must not run `npm run build`. Production build and deployment validation require explicit instruction outside the normal phase workflow.

## Recommended Development Sequence

1. Repository foundation
2. Design foundation
3. Authentication and access
4. Opening story and world navigation
5. Storybook
6. Private library
7. Puzzle engine
8. Music
9. Question Garden
10. Gallery
11. Journey
12. Maybe Days
13. Messaging
14. Open When and final room
15. Brian Studio completion
16. Security hardening
17. Content integration
18. Release validation

Every phase requires its own prompt and review. Codex must stop after every phase.

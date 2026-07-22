# DESIGN.md

## Design Vision

The Beginning of Maybe should feel like a small private world created specifically for Jessica.

The design must combine romance, playfulness, cinematic storytelling, warmth, mystery, elegance, simplicity, and comfortable interaction.

The application should not look like a normal dashboard, questionnaire, gallery, calendar, or chat product. Each section should have its own atmosphere while remaining part of one consistent visual world.

## Emotional Direction

The interface should communicate:

1. This was made intentionally.
2. Jessica is welcome here.
3. The experience is private.
4. Nothing is being rushed.
5. The story is still beginning.
6. Exploration should feel fun.
7. Jessica remains in control.

The app must not feel possessive, overly intense, childish, cluttered, manipulative, cheap, generic, corporate, or like a public dating application.

## Product Identity

Product name:

**The Beginning of Maybe**

Suggested supporting line:

> Some stories begin with a plan. Ours began with a screenshot notification.

Alternative supporting line:

> A little world created from an unexpected beginning.

Use supporting lines sparingly.

## Primary Experience

Recommended top level areas:

1. The Entrance
2. The Opening Story
3. The World Map
4. The Storybook
5. The Library
6. The Puzzle Room
7. Jessica's Radio
8. The Question Garden
9. Jessica's Gallery
10. Our Journey
11. Maybe Days
12. Our Corner
13. Open When
14. The Final Room

Navigation should feel like moving between locations rather than browsing a conventional menu. A simple accessible navigation option must still exist.

## Visual Language

Use:

1. Soft lighting
2. Layered depth
3. Gentle gradients
4. Paper and book textures
5. Floating particles
6. Warm shadows
7. Delicate highlights
8. Controlled glow
9. Cinematic spacing
10. Smooth transitions

Avoid excessive glassmorphism. Avoid filling every surface with glow. Avoid using hearts everywhere. Romance should come from storytelling, detail, typography, motion, and restraint.

## Colour System

Use semantic design tokens rather than scattered hardcoded values.

### Midnight

For cinematic backgrounds and night scenes:

```text
Midnight 950: #090B18
Midnight 900: #101327
Midnight 800: #181D38
```

### Cream

For book pages and warm reading surfaces:

```text
Cream 50: #FFFDF7
Cream 100: #FAF4E8
Cream 200: #F1E5D2
```

### Rose

For emotional highlights:

```text
Rose 300: #E9A7B5
Rose 400: #DD8499
Rose 500: #C9647D
```

### Burgundy

For deep romantic accents:

```text
Burgundy 500: #8B3A52
Burgundy 600: #6E2B41
Burgundy 700: #522033
```

### Gold

For rare celebratory details:

```text
Gold 300: #E8CB8B
Gold 400: #D7B56B
Gold 500: #B99145
```

### Lavender

For dreamlike secondary accents:

```text
Lavender 300: #C7B4EC
Lavender 400: #A993D8
```

Success, warning, and error colours must remain accessible and distinct from decorative colours.

## Typography

Use two principal font roles and one optional accent role.

### Display Typeface

Use for titles, chapter headings, book covers, romantic statements, and the final room.

### Body Typeface

Use for story text, messages, activities, questions, settings, and descriptions.

### Handwritten Accent

Use only for short notes, signatures, annotations, and secret messages. Never use it for long paragraphs.

Typography rules:

1. Use fluid responsive sizes.
2. Avoid very thin body text.
3. Maintain comfortable line height.
4. Limit paragraph width.
5. Preserve clear hierarchy.
6. Prevent text clipping during animation.
7. Keep text readable over moving backgrounds.
8. Do not use typography style alone to communicate state.

## Layout and Spacing

Use a 4px base spacing scale:

```text
4, 8, 12, 16, 24, 32, 48, 64, 80, 96
```

Rules:

1. Use generous spacing.
2. Avoid crowded mobile layouts.
3. Keep key controls within thumb reach.
4. Respect mobile safe areas.
5. Use maximum reading widths.
6. Let cinematic sections use full viewport space.
7. Keep persistent controls minimal.
8. Avoid accidental horizontal scrolling.
9. Support portrait and landscape screens.
10. Never place essential controls behind decorative effects.

## Motion System

Motion should explain, reveal, reward, or guide.

Rules:

1. Avoid purposeless animation.
2. Keep interactions responsive.
3. Never block navigation for decoration.
4. Allow cinematic sequences to be skipped after first viewing.
5. Respect reduced motion.
6. Pause or reduce effects when the tab is hidden.
7. Limit continuously moving particles.
8. Do not create motion that causes nausea.

Suggested timing:

```text
Micro interactions: 120ms to 240ms
Section transitions: 350ms to 700ms
Cinematic sequences: 1s to 4s
```

### Reduced Motion

When reduced motion is enabled:

1. Replace parallax with static layouts.
2. Replace page flips with fades or simple slides.
3. Stop floating particles.
4. Remove cursor tracking.
5. Remove camera shake.
6. Keep all information and controls.
7. Keep transitions short.

## Entrance

The entrance should feel private and mysterious.

Suggested sequence:

1. Calm dark background
2. Small points of light
3. A message indicating that the world belongs to Jessica
4. A romantic clue puzzle
5. Authentication when required
6. A door, book, or light opening animation
7. Transition into the opening story

Required controls:

1. Audio control
2. Reduced motion support
3. Accessible text input
4. Clear errors
5. Secure access recovery
6. No public sign up

## Opening Story

Recreate the feeling of the Snapchat incident without pretending to show the original chat.

Suggested sequence:

1. Brian working
2. A profile inspired card
3. Camera flash
4. Screenshot notification
5. Short humorous panic moment
6. Honest narration
7. Reveal of the title

Suggested copy direction:

> I was working when your profile appeared.

> I knew I wanted to message you properly when I was done.

> So I took a screenshot.

> Snapchat immediately exposed me.

> I had to explain.

> Somehow, that embarrassing moment became the beginning of us talking.

Add a small note where appropriate:

> A playful reconstruction of how it began.

Do not copy Snapchat's protected interface exactly. Create an original interpretation.

## World Map

The world map may use a constellation, floating island, illustrated night landscape, storybook map, or dreamlike room system.

Each destination should show:

1. Name
2. Short description
3. Locked or unlocked state
4. Progress state
5. Accessible direct navigation

Locked sections should create curiosity, not punishment. Puzzles should not permanently block core content.

## Storybook

The storybook must feel physical without sacrificing usability.

Required qualities:

1. Realistic page proportions
2. Page shadows
3. Paper texture
4. Page numbers
5. Chapter indication
6. Previous and next buttons
7. Swipe support
8. Keyboard support
9. Table of contents
10. Reading progress
11. Resume reading
12. Reduced motion fallback
13. Mobile reading mode

The original story is expected to contain about 30 short pages.

Possible page types:

1. Standard text
2. Full illustration
3. Short quote
4. Puzzle page
5. Interactive envelope
6. Photograph page
7. Map page
8. Music linked page
9. Empty future page
10. Final unfinished page

Do not overload every page with interaction.

## Private Library

The library should feel like a quiet personal reading room.

A book card may include:

1. Cover
2. Title
3. Author
4. Description
5. Format
6. Reading status
7. Open button
8. Download button when permitted
9. Download disabled state
10. Personal note
11. Add to reading list
12. Read together option

The presence of a book must not imply that downloading is permitted. Download permission must be explicit.

## Puzzles

Puzzles should take approximately 30 seconds to 2 minutes.

Every puzzle needs:

1. Clear objective
2. Hint
3. Skip
4. Retry
5. Friendly success feedback
6. No punishment
7. No negative score
8. No aggressive timer
9. Accessible controls
10. Reduced motion behaviour

Examples:

1. Arrange story events
2. Connect stars to form Jessica
3. Find a hidden key
4. Complete a sentence
5. Small image puzzle
6. Match cards
7. Select the correct object
8. Choose a path
9. Unlock an envelope
10. Find a hidden symbol

Possible rewards:

1. Story page
2. Song
3. Note
4. Flower
5. Star
6. Gallery item
7. Activity
8. Letter

## Jessica's Radio

Possible visual styles:

1. Record player
2. Cassette deck
3. Small radio studio
4. Dreamlike listening room

Required controls:

1. Play
2. Pause
3. Previous
4. Next
5. Seek
6. Volume
7. Mute
8. Queue
9. Song details
10. Background audio preference

Rules:

1. Never start loudly.
2. Never autoplay sound without interaction.
3. Keep pause and mute visible.
4. Remember preference where appropriate.
5. Stop audio on logout.
6. Use only authorised media.

Suggested collections:

1. Jessica's favourites
2. Songs that remind me of you
3. Late night conversations
4. Songs we discover together

## Question Garden

This section must not resemble a normal form.

Possible environments:

1. Garden
2. Lantern field
3. Constellation
4. Floating letters
5. Blooming flowers

Each object reveals one question. On answering, a flower may bloom, a star may light, a lantern may glow, or a butterfly may appear.

Required actions:

1. Answer
2. Skip
3. Save privately
4. Edit
5. Delete
6. Send to Brian
7. Keep private

Nothing is sent automatically. Do not require every question. Avoid pressure based progress indicators.

## Gallery

A small number of photographs should feel meaningful.

Possible treatments:

1. Floating Polaroids
2. Film strip
3. Scrapbook
4. Virtual photo room
5. Hanging photographs
6. Story pages

Each item may include a caption, date when appropriate, context, favourite action, and privacy state.

Do not show a download button unless explicitly enabled.

## Journey

Initial honest milestones:

1. Before we met
2. The accept
3. The screenshot
4. The explanation
5. The conversations
6. The beginning of maybe

Do not invent future memories.

Possible visual models:

1. Two stars
2. A path
3. A train route
4. A map
5. A constellation
6. Two lights moving closer

## Maybe Days

The calendar should feel playful rather than formal.

Activity examples:

1. Movie night
2. Music exchange
3. Online game
4. Voice call
5. Five questions
6. Same meal
7. Day photographs
8. Sunset from both places
9. Virtual travel planning
10. Funny story night

Each card may show title, description, date, duration, both local times, response options, and a way to suggest another day.

Friendly response copy:

1. I would love this
2. Maybe another day
3. Choose something else
4. Not this one 😂

## Our Corner

The private messaging section should feel calm and personal.

Possible features:

1. Text
2. Reactions
3. Replies
4. Images
5. Short videos
6. Voice notes
7. Song cards
8. Question cards
9. Calendar cards
10. Memory cards
11. Typing state
12. Delivery state
13. Read receipt control
14. Delete
15. Media preview

Do not overanimate message arrival. Privacy controls must remain visible and understandable.

## Boredom Button

Possible label:

**Jessica is bored**

It may offer one lightweight activity:

1. Puzzle
2. Question
3. Song
4. Note
5. Photo challenge
6. Game
7. Maybe Day suggestion
8. Open When letter

Avoid immediate repetition. Do not collect hidden behavioural data.

## Open When Letters

Suggested letters:

1. Open when you are bored
2. Open when your day feels heavy
3. Open when you need to smile
4. Open when you cannot sleep
5. Open when you wonder why I made this
6. Open when you want a random challenge

Letters may unlock through a date, puzzle, activity, or manual selection. Never use them to create guilt.

## Final Room

The final room should feel peaceful.

Suggested tone:

> Jessica, we have only just met, and I know this is still the beginning. I did not create this to rush anything. I created it because meeting you made an ordinary moment feel worth remembering.

Possible responses:

1. Let us keep writing the story
2. Brian, you are dramatic 😂
3. I need another puzzle first

Do not treat any response as a binding romantic decision.

## Shared Component States

Every shared component should define:

1. Default
2. Hover
3. Focus
4. Active
5. Disabled
6. Loading
7. Error
8. Empty when relevant
9. Reduced motion behaviour
10. Mobile behaviour

Possible core components:

1. Button
2. Icon button
3. Dialog
4. Sheet
5. Card
6. Tooltip
7. Toast
8. Audio controls
9. Progress indicator
10. Puzzle shell
11. Book page
12. Media card
13. Activity card
14. Message bubble
15. Question object
16. Navigation portal

## Performance Design

1. Avoid unnecessary full screen video.
2. Optimise images.
3. Lazy load heavy sections.
4. Load book pages progressively.
5. Pause hidden animations.
6. Limit particle counts.
7. Avoid large uncompressed audio.
8. Avoid layout shifts.
9. Keep first interaction responsive.
10. Provide lightweight fallbacks.

The application must remain beautiful when advanced effects are unavailable.

# SECURITY.md

## Purpose

The Beginning of Maybe will contain private and personal information, including photographs, books, music choices, question answers, calendar activities, private messages, voice notes, videos, and shared memories.

Security and privacy are product requirements, not optional enhancements.

The romantic entrance and puzzles create atmosphere. They must never be treated as the real security boundary.

## Security Model

Use defence in depth:

1. Invite only access
2. Real authentication
3. Approved membership
4. Server side authorization
5. Row Level Security
6. Private object storage
7. Short lived authorised media access
8. Input validation
9. Upload restrictions
10. Rate limiting
11. Secure environment handling
12. Safe logging
13. Session management
14. User controlled privacy
15. Revocable access

## Initial Roles

### Brian

Brian is the owner and administrator. He may manage approved users, story content, books, music, gallery items, activities, questions, letters, journey events, sessions, and private application settings.

### Jessica

Jessica is the invited private user. She may explore the experience, read approved content, complete puzzles, listen to music, view approved gallery items, answer questions, choose whether to share answers, respond to activities, and use the private messaging features.

No public registration should exist unless a later phase explicitly introduces it.

## Authentication

1. Use a real authentication provider.
2. Prefer invite based email authentication, a magic link, a one time password, or another secure invite flow.
3. Verify authentication on the server.
4. Verify approved membership separately from authentication.
5. Do not rely only on middleware.
6. Recheck authorization inside sensitive Server Actions and Route Handlers.
7. Allow sessions to be revoked.
8. Rate limit repeated attempts.
9. Use generic authentication errors.
10. Do not reveal whether an unapproved email has an account.
11. Do not create custom password cryptography.
12. Do not store plain text passwords.
13. Do not create public sign up.
14. Do not expose a permanent bypass.

## Entrance Puzzle

The entrance puzzle may use clues related to Snapchat, a screenshot notification, Jessica, and the app where the story began.

Rules:

1. The puzzle is an experience gate, not the primary security control.
2. Do not protect private content using only a client side answer.
3. Do not expose sensitive personal information as a security question.
4. Rate limit repeated attempts when puzzle validation protects access state.
5. Do not store security sensitive answers in plainly readable client code.
6. Allow authenticated trusted sessions to avoid unnecessary repeated friction.
7. Keep puzzle failures friendly and nonrevealing.

## Database Security

If Supabase is used:

1. Enable Row Level Security on every private table.
2. Do not use a private table before its policies exist.
3. Test policies with authorised, unauthorised, and cross user requests.
4. Use database constraints in addition to application validation.
5. Prevent users from changing immutable ownership fields.
6. Use server or database generated timestamps.
7. Keep privileged operations server only.
8. Never expose the service role key.
9. Do not write policies that trust a user supplied owner identifier.
10. Prevent access through guessed record IDs.
11. Keep owner operations separate from normal member operations.
12. Record only necessary audit data.
13. Do not expose private metadata to unapproved users.
14. Validate conversation membership before message operations.
15. Validate app membership before any protected content operation.

Possible future private tables include:

```text
profiles
app_members
trusted_sessions
story_progress
puzzle_progress
books
songs
playlists
playlist_items
gallery_items
questions
question_answers
journey_events
calendar_activities
activity_responses
conversations
conversation_members
messages
message_attachments
open_when_letters
notifications
security_events
```

Create tables only during their approved phases.

## Media Security

Private media must never be stored in the public repository.

### Local Development Structure

The media structure will be created only during the approved media phase:

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

Requirements:

1. `media/private/` must be ignored by Git.
2. `media/placeholders/` may contain only neutral nonpersonal assets.
3. Never place private media in `public/`.
4. Never serve `media/private/` through a static route.
5. Never expose local file paths in application responses.
6. Use the local private folder only for controlled development import.
7. Production media must use private object storage.

### Production Buckets

Recommended private buckets:

```text
private-books
private-gallery
private-music
private-voice-notes
private-chat-media
```

Every bucket must remain private.

Access must require authentication, membership, server authorization where appropriate, storage policies, and short lived signed URLs when required.

### Upload Validation

Validate more than the filename:

1. Allowlisted MIME type
2. File extension
3. Maximum file size
4. File signature where practical
5. Sanitised generated filename
6. User ownership
7. Upload purpose
8. Content category
9. Malware scanning when available
10. Image metadata removal or control where appropriate

Do not trust the browser supplied MIME type alone.

Suggested initial limits:

```text
Gallery image: 10 MB
Chat image: 10 MB
Short chat video: 50 MB
Voice note: 20 MB
PDF book: 100 MB
EPUB book: 50 MB
Music file: 30 MB
```

### Signed URLs

1. Generate signed URLs only after authorization.
2. Use short expiration periods.
3. Do not store signed URLs permanently.
4. Do not include signed URLs in email.
5. Do not expose storage credentials.
6. Avoid predictable paths containing private names.
7. Revoke access through membership or object removal.

## Books and Music

1. Brian will provide the files.
2. Do not download copyrighted content automatically.
3. Do not assume redistribution or download permission.
4. Each book must have a `download_allowed` setting.
5. Default book downloads to disabled.
6. Each song must record its source and playback method.
7. Prefer authorised files or legal streaming embeds.
8. Do not make music downloadable by default.
9. Do not expose original storage paths.
10. Do not bypass DRM or protected delivery.

## Messaging Security

1. Only conversation members may read or send messages.
2. Validate membership on the server.
3. Protect message records with Row Level Security.
4. Keep attachments private.
5. Restrict text length, attachment types, and attachment sizes.
6. Never render raw user supplied HTML.
7. Use structured validated payloads for song, question, activity, and memory cards.
8. Protect against duplicate submissions.
9. Use server timestamps.
10. Validate reply references.
11. Prevent access through guessed IDs.
12. Rate limit messages and uploads.
13. Do not include message bodies in logs.
14. Do not include private message text in email notifications.
15. Support logout and session revocation.
16. Do not claim end to end encryption unless it is genuinely implemented and reviewed.
17. HTTPS, database encryption, and access controls are not end to end encryption.

## Question Answers

1. Jessica must decide whether to share an answer.
2. Draft answers must remain private.
3. Do not email answer content automatically.
4. Prefer in application notifications without sensitive content.
5. Support edit and deletion.
6. Allow questions to be skipped.
7. Do not pressure completion.
8. Protect answers with Row Level Security.
9. Do not send answers to third parties without explicit consent.
10. Status may be `draft`, `private`, or `shared`.

## Calendar Privacy

1. Do not access a device calendar without explicit permission.
2. Do not add events automatically.
3. Do not collect precise location.
4. Store timestamps in UTC.
5. Use IANA time zones.
6. Display both local times clearly.
7. Let Jessica accept, decline, or suggest another time.
8. Do not treat a response as a binding commitment.
9. Do not create public calendar links.
10. Protect all activity records.

## Environment Variables

1. Real secrets belong in `.env.local`.
2. `.env.local` must be ignored by Git.
3. `.env.example` contains placeholders only.
4. Publicly prefixed variables may contain only values safe for the browser.
5. Service role keys remain server only.
6. Never print environment variables.
7. Never include secrets in screenshots, logs, or errors.
8. Validate required environment configuration.
9. Fail safely when configuration is missing.
10. Add variables only when their phase requires them.

Possible placeholders:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_BASE_URL=
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=
```

## Logging and Errors

Never log:

1. Passwords
2. Puzzle security answers
3. Access tokens
4. Service keys
5. Message bodies
6. Personal question answers
7. Signed URLs
8. Private media contents
9. Authentication links

Use gentle user facing errors and controlled internal identifiers. Do not expose database or storage implementation details.

Avoid session replay and intrusive analytics inside private areas.

## Headers and Browser Security

Before release, configure and test:

1. Content Security Policy
2. Strict Transport Security
3. Referrer Policy
4. Permissions Policy
5. Frame restrictions
6. MIME sniffing protection
7. Secure cookies
8. Allowed origins

Test headers against required fonts, embeds, media, Supabase, and email flows.

## Rate Limiting

Apply reasonable rate limits to:

1. Authentication attempts
2. Puzzle validation
3. Message sending
4. Media uploads
5. Question submissions
6. Calendar responses
7. Signed URL generation
8. Email notifications
9. Administrative actions

Rate limiting must not reveal account or membership status.

## Privacy

1. Collect the minimum necessary data.
2. Explain what is stored.
3. Ask before saving personal data.
4. Provide deletion controls.
5. Provide logout and session revocation.
6. Do not sell or share private information.
7. Do not add advertising trackers.
8. Do not track precise location.
9. Do not collect contacts.
10. Do not access camera or microphone without explicit action.
11. Do not automatically upload local files.
12. Avoid unnecessary third party scripts.
13. Prevent search engine indexing of private areas.

## Security Testing

Before release, test:

1. Unauthenticated access
2. Authenticated but unapproved access
3. Cross user database access
4. Cross user storage access
5. Direct protected route access
6. Direct API access
7. Object identifier guessing
8. Signed URL expiration
9. File type restrictions
10. File size restrictions
11. Message membership checks
12. Privileged server actions
13. Puzzle rate limiting
14. Session revocation
15. XSS attempts
16. Malformed input
17. Duplicate requests
18. Missing environment variables
19. Private asset leakage into public output
20. Git history for accidental media or secrets

Automated checks do not replace manual review. Report all limitations honestly.

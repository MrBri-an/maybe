import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/content-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextInput } from "@/components/ui/text-input";
import { CelestialBackground } from "@/components/motion/celestial-background";
import { WorldExperience } from "@/features/world/world-experience";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { loadUserJourneyProgress } from "@/lib/progression/user-progress";
import { getMissingServerConfigVariables, getServerSupabaseConfig } from "@/lib/supabase/server-config";
import { logout, requestMagicLink, submitPuzzle } from "./access/actions";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function EntranceFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <CelestialBackground />
      <main className="access-main">
        <ContentContainer size="reading">
          <div className="access-brand" aria-hidden="true">✦</div>
          {children}
        </ContentContainer>
      </main>
    </AppShell>
  );
}

function ConfigurationState() {
  const missingVariables = process.env.NODE_ENV === "development"
    ? getMissingServerConfigVariables()
    : [];

  return (
    <EntranceFrame>
      <Card className="access-card">
        <Badge tone="warning">Setup needed</Badge>
        <h1>A private door is being prepared.</h1>
        <p>The secure connection is not configured, so no sign-in attempt was made.</p>
        <p className="access-note">Add the required values to a local, uncommitted environment file.</p>
        {missingVariables.length > 0 ? (
          <div className="configuration-missing" role="status">
            <p>Missing variable names:</p>
            <ul>{missingVariables.map((name) => <li key={name}><code>{name}</code></li>)}</ul>
          </div>
        ) : null}
      </Card>
    </EntranceFrame>
  );
}

function DeniedState({ inactive = false }: { inactive?: boolean }) {
  return (
    <EntranceFrame>
      <Card className="access-card">
        <Badge tone="warning">Access unavailable</Badge>
        <h1>This door is not open for this account.</h1>
        <p>{inactive ? "This invitation is currently inactive." : "This private world is available only to approved invitations."}</p>
        <form action={logout}><Button type="submit" variant="secondary">Sign out safely</Button></form>
      </Card>
    </EntranceFrame>
  );
}

function PuzzleState({ error }: { error?: string }) {
  const message = error === "wait"
    ? "Take a short pause before trying again."
    : error === "clue"
      ? "Almost. Think of the app at the very beginning."
      : error === "configuration"
        ? "The secure gate could not be saved. Please try again later."
        : null;

  return (
    <EntranceFrame>
      <Card className="access-card puzzle-card">
        <div className="access-card-topline">
          <Badge tone="rose">One small clue</Badge>
          <span>Experience gate · Not security</span>
        </div>
        <h1>What app did our story begin on?</h1>
        <p>Authentication is complete. This playful clue remembers the beginning without replacing the private invitation check.</p>
        {message ? <p className="access-alert" role="alert">{message}</p> : null}
        <form className="access-form puzzle-form" action={submitPuzzle}>
          <TextInput id="answer" name="answer" label="Your answer" autoComplete="off" maxLength={40} required />
          <Button type="submit">Open the little world</Button>
        </form>
        <form className="access-secondary-action" action={logout}>
          <Button type="submit" variant="quiet" size="small">Sign out</Button>
        </form>
      </Card>
    </EntranceFrame>
  );
}

function EmailAccess({ error, sent }: { error?: string; sent: boolean }) {
  return (
    <EntranceFrame>
      <Card className="access-card">
        <Badge tone="rose">Private invitation</Badge>
        <h1>A little world, with a real lock on the door.</h1>
        <p>Enter the email address that received an invitation. If approved, a secure magic link will arrive—without public registration.</p>
        {sent ? <p className="access-success" role="status">If this address has an active invitation, a magic link is on its way.</p> : null}
        {error === "email" ? <p className="access-alert" role="alert">Enter a complete email address to continue.</p> : null}
        {error === "link" ? <p className="access-alert" role="alert">That link is invalid or expired. Request a fresh one below.</p> : null}
        {error === "denied" ? <p className="access-alert" role="alert">That account does not have an active invitation.</p> : null}
        <form className="access-form" action={requestMagicLink}>
          <TextInput id="email" name="email" type="email" label="Invited email" hint="The response stays generic to protect the invitation list." autoComplete="email" inputMode="email" maxLength={254} required />
          <Button type="submit">Send my private link</Button>
        </form>
        <p className="access-note">The clue follows authentication. It is part of the experience, never its security boundary.</p>
      </Card>
    </EntranceFrame>
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const error = getParam(params.error);

  if (!getServerSupabaseConfig()) return <ConfigurationState />;

  const access = await getAuthenticatedAccess();

  if (access.ok) {
    if (await hasPassedExperienceGate(access.user.id)) {
      const journey = await loadUserJourneyProgress();
      return <WorldExperience logoutAction={logout} initialView={getParam(params.view) === "world" ? "world" : "opening"} storybookCompleted={Boolean(journey?.progress.storybook_completed_at)} libraryCompleted={Boolean(journey?.progress.library_completed_at)} puzzleRoomCompleted={Boolean(journey?.progress.puzzle_room_completed_at)} radioCompleted={Boolean(journey?.progress.radio_completed_at)} questionGardenCompleted={Boolean(journey?.progress.question_garden_completed_at)} initialDestination={journey?.progress.last_world_destination ?? null} />;
    }
    return <PuzzleState error={error} />;
  }

  if (access.reason === "configuration") return <ConfigurationState />;
  if (access.reason === "not-approved" || access.reason === "inactive") return <DeniedState inactive={access.reason === "inactive"} />;

  return <EmailAccess error={error} sent={getParam(params.sent) === "1"} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/content-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextInput } from "@/components/ui/text-input";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import { logout, requestMagicLink, submitPuzzle } from "./actions";

export const metadata: Metadata = {
  title: "Private access · The Beginning of Maybe",
};

type AccessPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function AccessFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
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
  return (
    <AccessFrame>
      <Card className="access-card">
        <Badge tone="warning">Setup needed</Badge>
        <h1>A private door is being prepared.</h1>
        <p>
          Access is unavailable because the secure server connection has not been configured.
          No sign-in attempt was made.
        </p>
        <p className="access-note">Add the required values to a local, uncommitted environment file.</p>
      </Card>
    </AccessFrame>
  );
}

function DeniedState({ inactive = false }: { inactive?: boolean }) {
  return (
    <AccessFrame>
      <Card className="access-card">
        <Badge tone="warning">Access unavailable</Badge>
        <h1>This door is not open for this account.</h1>
        <p>
          {inactive
            ? "This invitation is currently inactive. Brian can review it privately."
            : "This space is invite-only. The signed-in account is not on the approved list."}
        </p>
        <form action={logout}>
          <Button type="submit" variant="secondary">Sign out safely</Button>
        </form>
      </Card>
    </AccessFrame>
  );
}

function PuzzleState({ error }: { error?: string }) {
  const errorMessage = error === "wait"
    ? "Take a short pause before trying the clues again."
    : error === "clues"
      ? "Almost. One or more clues need another gentle look."
      : error === "configuration"
        ? "The secure gate could not be saved. Please try again later."
        : null;

  return (
    <AccessFrame>
      <Card className="access-card puzzle-card">
        <div className="access-card-topline">
          <Badge tone="rose">One small memory</Badge>
          <span>Experience gate · Not security</span>
        </div>
        <h1>Three clues before the door opens.</h1>
        <p>
          Authentication is complete. This playful step remembers how the story began;
          it does not replace the secure invitation check.
        </p>

        {errorMessage ? <p className="access-alert" role="alert">{errorMessage}</p> : null}

        <form className="access-form puzzle-form" action={submitPuzzle}>
          <TextInput
            id="beginning"
            name="beginning"
            label="Clue one · The app where it began"
            autoComplete="off"
            maxLength={40}
            required
          />
          <TextInput
            id="notification"
            name="notification"
            label="Clue two · What gave the secret away?"
            autoComplete="off"
            maxLength={60}
            required
          />
          <TextInput
            id="person"
            name="person"
            label="Clue three · Whose little world is this?"
            autoComplete="off"
            maxLength={40}
            required
          />
          <Button type="submit">Open the little world</Button>
        </form>

        <form className="access-secondary-action" action={logout}>
          <Button type="submit" variant="quiet" size="small">Sign out</Button>
        </form>
      </Card>
    </AccessFrame>
  );
}

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const params = await searchParams;
  const error = getParam(params.error);
  const sent = getParam(params.sent) === "1";

  if (!getServerSupabaseConfig() || error === "configuration") {
    return <ConfigurationState />;
  }

  const access = await getAuthenticatedAccess();

  if (access.ok) {
    if (await hasPassedExperienceGate(access.user.id)) {
      redirect("/world");
    }

    return <PuzzleState error={error} />;
  }

  if (access.reason === "configuration") {
    return <ConfigurationState />;
  }

  if (access.reason === "not-approved" || access.reason === "inactive") {
    return <DeniedState inactive={access.reason === "inactive"} />;
  }

  return (
    <AccessFrame>
      <Card className="access-card">
        <Badge tone="rose">Private invitation</Badge>
        <h1>A little world, with a real lock on the door.</h1>
        <p>
          Enter the email address that received an invitation. If it is approved,
          Supabase will send a secure magic link—no password and no public sign-up.
        </p>

        {sent ? (
          <p className="access-success" role="status">
            If this address has an active invitation, a magic link is on its way.
          </p>
        ) : null}
        {error === "email" ? (
          <p className="access-alert" role="alert">Enter a complete email address to continue.</p>
        ) : null}
        {error === "link" ? (
          <p className="access-alert" role="alert">That link is invalid or expired. Request a fresh one below.</p>
        ) : null}
        {error === "denied" ? (
          <p className="access-alert" role="alert">That account does not have an active invitation.</p>
        ) : null}

        <form className="access-form" action={requestMagicLink}>
          <TextInput
            id="email"
            name="email"
            type="email"
            label="Invited email"
            hint="The response stays intentionally generic to protect the invitation list."
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
          />
          <Button type="submit">Send my private link</Button>
        </form>

        <p className="access-note">
          The romantic clue comes after authentication. It is part of the experience,
          never the security boundary.
        </p>
      </Card>
    </AccessFrame>
  );
}

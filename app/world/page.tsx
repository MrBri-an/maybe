import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/content-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasPassedExperienceGate } from "@/lib/auth/experience-gate";
import { getAuthenticatedAccess } from "@/lib/auth/membership";
import { logout } from "@/app/access/actions";

export const metadata: Metadata = {
  title: "Private world · The Beginning of Maybe",
};

export default async function WorldPage() {
  const access = await getAuthenticatedAccess();

  if (!access.ok) {
    redirect(access.reason === "configuration" ? "/access?error=configuration" : "/access?error=denied");
  }

  if (!(await hasPassedExperienceGate(access.user.id))) {
    redirect("/access?step=puzzle");
  }

  return (
    <AppShell>
      <main className="access-main">
        <ContentContainer size="reading">
          <Card className="access-card world-card">
            <Badge tone="success">Securely inside</Badge>
            <h1>The private world is waiting.</h1>
            <p>
              Authentication, approved membership, active status, and the experience gate
              were all verified on the server. The world itself begins in a later phase.
            </p>
            <div className="world-status" role="status">
              <span aria-hidden="true">✦</span>
              <p>Private access foundation complete</p>
            </div>
            <form action={logout}>
              <Button type="submit" variant="secondary">Leave this world safely</Button>
            </form>
          </Card>
        </ContentContainer>
      </main>
    </AppShell>
  );
}

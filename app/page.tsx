import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/content-container";
import { Section } from "@/components/layout/section";
import { FadeReveal } from "@/components/motion/fade-reveal";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Progress } from "@/components/ui/progress";
import { TextInput } from "@/components/ui/text-input";

const colours = [
  { name: "Midnight", token: "midnight" },
  { name: "Cream", token: "cream" },
  { name: "Rose", token: "rose" },
  { name: "Burgundy", token: "burgundy" },
  { name: "Gold", token: "gold" },
  { name: "Lavender", token: "lavender" },
] as const;

const futureRooms = [
  {
    symbol: "01",
    title: "The Storybook",
    description: "A quiet place for pages, chapters, and the moments that shaped the beginning.",
    accent: "rose",
  },
  {
    symbol: "02",
    title: "Jessica’s Radio",
    description: "A listening room for songs chosen with care. No audio is connected yet.",
    accent: "gold",
  },
  {
    symbol: "03",
    title: "The Puzzle Room",
    description: "Small, forgiving curiosities designed for play, never pressure.",
    accent: "lavender",
  },
  {
    symbol: "04",
    title: "The Question Garden",
    description: "A future space for thoughtful questions, privacy, and complete control.",
    accent: "cream",
  },
] as const;

type RoomPreviewProps = (typeof futureRooms)[number];

function RoomPreview({ symbol, title, description, accent }: RoomPreviewProps) {
  return (
    <Card className={`room-preview room-preview-${accent}`}>
      <div className="room-preview-topline">
        <span className="room-number" aria-hidden="true">{symbol}</span>
        <Badge tone="neutral">Future room</Badge>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <p className="room-status">Preview only · Not yet available</p>
    </Card>
  );
}

export default function Home() {
  return (
    <AppShell>
      <main>
        <ContentContainer size="wide">
          <section className="hero" aria-labelledby="project-title">
            <FadeReveal className="hero-copy">
              <Badge tone="rose">Design foundation · Phase 2</Badge>
              <p className="hero-kicker">A private little world for Jessica</p>
              <h1 id="project-title">The Beginning<br />of Maybe</h1>
              <p className="hero-message">
                A visual language for the soft, cinematic moments still to come—warm,
                unhurried, and made to feel comfortable on every screen.
              </p>
              <div className="hero-actions" aria-label="Component preview actions">
                <Button type="button">Primary moment</Button>
                <Button type="button" variant="secondary">Quiet alternative</Button>
                <IconButton type="button" label="Save this future moment">
                  <span aria-hidden="true">✦</span>
                </IconButton>
              </div>
            </FadeReveal>

            <FadeReveal className="hero-orbit" delay={0.12} distance={10}>
              <div className="orbit-card" aria-label="Decorative motion preview">
                <span className="orbit-line" aria-hidden="true" />
                <span className="orbit-star orbit-star-large" aria-hidden="true">✦</span>
                <span className="orbit-star orbit-star-small" aria-hidden="true">·</span>
                <p>Motion, with restraint</p>
                <span>Reveals guide attention and become still when reduced motion is preferred.</span>
              </div>
            </FadeReveal>
          </section>

          <Divider label="The visual language" />

          <FadeReveal>
            <Section
              id="colour-and-type"
              eyebrow="Foundations"
              title="Colour with a sense of place"
              description="Midnight holds the world together. Cream keeps it readable. Rose, burgundy, gold, and lavender appear only when a moment deserves them."
            >
              <div className="colour-grid" aria-label="Design system colour palette">
                {colours.map((colour) => (
                  <div className="colour-swatch" key={colour.token}>
                    <span className={`swatch swatch-${colour.token}`} aria-hidden="true" />
                    <span>{colour.name}</span>
                  </div>
                ))}
              </div>

              <div className="type-grid">
                <Card tone="cream" className="type-card">
                  <Badge tone="gold">Display</Badge>
                  <p className="type-display">Some beginnings arrive quietly.</p>
                  <span>Georgia · Fluid scale · Warm editorial character</span>
                </Card>
                <Card className="type-card">
                  <Badge>Body</Badge>
                  <p className="type-body">
                    Clear, comfortable reading comes first. Body copy stays calm, spacious,
                    and useful even when every decorative layer is removed.
                  </p>
                  <span>System sans · Comfortable measure · Reliable loading</span>
                </Card>
              </div>
            </Section>
          </FadeReveal>

          <FadeReveal>
            <Section
              id="components"
              eyebrow="Reusable pieces"
              title="Small details, consistent care"
              description="These primitives define the shared states future experiences can rely on without deciding those experiences early."
            >
              <div className="component-showcase">
                <Card className="showcase-card">
                  <div className="showcase-heading">
                    <div>
                      <p className="component-label">Actions</p>
                      <h3>Buttons and badges</h3>
                    </div>
                    <Badge tone="success">Ready</Badge>
                  </div>
                  <div className="button-row">
                    <Button type="button" size="small">Continue</Button>
                    <Button type="button" size="small" variant="secondary">Not yet</Button>
                    <Button type="button" size="small" variant="quiet">Skip gently</Button>
                    <Button type="button" size="small" disabled>Unavailable</Button>
                  </div>
                  <div className="badge-row" aria-label="Badge examples">
                    <Badge tone="rose">A soft highlight</Badge>
                    <Badge tone="gold">Something special</Badge>
                    <Badge tone="warning">Needs attention</Badge>
                  </div>
                </Card>

                <Card className="showcase-card">
                  <p className="component-label">Form language</p>
                  <h3>A clear place to respond</h3>
                  <TextInput
                    id="preview-note"
                    label="A small note"
                    hint="This preview does not save or send anything."
                    placeholder="Write something gentle…"
                  />
                  <Divider />
                  <Progress label="Foundation progress" value={72} />
                </Card>
              </div>
            </Section>
          </FadeReveal>

          <FadeReveal>
            <Section
              id="motion"
              eyebrow="Motion principles"
              title="Movement that knows when to be still"
              description="Reveals explain hierarchy; they do not delay access. Each example runs once and respects the device’s reduced-motion preference."
            >
              <div className="motion-grid">
                {["Arrive", "Settle", "Remain"].map((label, index) => (
                  <FadeReveal key={label} delay={index * 0.08} distance={12}>
                    <Card className="motion-sample">
                      <span className="motion-index" aria-hidden="true">0{index + 1}</span>
                      <h3>{label}</h3>
                      <p>{index === 0 ? "A short reveal introduces context." : index === 1 ? "Elements land without bounce or spectacle." : "Nothing moves continuously for decoration."}</p>
                    </Card>
                  </FadeReveal>
                ))}
              </div>
            </Section>
          </FadeReveal>

          <FadeReveal>
            <Section
              id="future-rooms"
              eyebrow="A look ahead"
              title="Rooms that are still only possibilities"
              description="These cards demonstrate how future destinations may share one design language. They are labels, not links, and contain no feature behaviour."
            >
              <div className="room-grid">
                {futureRooms.map((room) => <RoomPreview key={room.title} {...room} />)}
              </div>
            </Section>
          </FadeReveal>

          <footer className="preview-footer">
            <span aria-hidden="true">✦</span>
            <p>The foundation is ready. The story remains for another phase.</p>
          </footer>
        </ContentContainer>
      </main>
    </AppShell>
  );
}

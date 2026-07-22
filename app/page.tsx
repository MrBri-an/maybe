export default function Home() {
  return (
    <main className="foundation-shell">
      <section className="foundation-card" aria-labelledby="project-title">
        <div className="foundation-copy">
          <p className="eyebrow">Phase one · Foundation</p>
          <h1 id="project-title">The Beginning of Maybe</h1>
          <p className="supporting-line">A private little world for Jessica.</p>
          <p className="status-line">
            <span className="status-marker" aria-hidden="true" />
            The story is being prepared.
          </p>
        </div>

        <div
          className="placeholder"
          role="img"
          aria-label="Decorative placeholder for a future approved visual"
        >
          <span className="placeholder-mark" aria-hidden="true">✦</span>
          <p>Decorative placeholder</p>
          <span>Neutral artwork will be introduced in a later phase.</span>
        </div>
      </section>
    </main>
  );
}

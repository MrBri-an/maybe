export type SaveRevision = {
  title: string;
  body: string;
  revision: number;
};

export type SaveOutcome<Result> = {
  draft: SaveRevision;
  result: Result;
};

export class LatestSaveQueue<Result> {
  private active = false;
  private queued: SaveRevision | null = null;
  private idleWaiters: Array<(outcome: SaveOutcome<Result> | null) => void> = [];
  private readonly save: (draft: SaveRevision) => Promise<Result>;

  constructor(save: (draft: SaveRevision) => Promise<Result>) {
    this.save = save;
  }

  enqueue(draft: SaveRevision): Promise<SaveOutcome<Result> | null> {
    this.queued = draft;
    const completion = new Promise<SaveOutcome<Result> | null>((resolve) => {
      this.idleWaiters.push(resolve);
    });
    if (!this.active) void this.drain();
    return completion;
  }

  discardQueued() {
    this.queued = null;
  }

  waitForIdle(): Promise<SaveOutcome<Result> | null> {
    if (!this.active) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private async drain() {
    this.active = true;
    let latestOutcome: SaveOutcome<Result> | null = null;
    while (this.queued) {
      const draft = this.queued;
      this.queued = null;
      latestOutcome = { draft, result: await this.save(draft) };
    }
    this.active = false;
    this.idleWaiters.splice(0).forEach((resolve) => resolve(latestOutcome));
  }
}

import assert from "node:assert/strict";
import test from "node:test";
import { LatestSaveQueue } from "../lib/final-world/latest-save-queue.ts";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("serializes saves and lets only the newest queued revision run", async () => {
  const first = deferred();
  const calls = [];
  let active = 0;
  let maximumActive = 0;
  const queue = new LatestSaveQueue(async (draft) => {
    calls.push(draft);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    const result = draft.revision === 1 ? await first.promise : `saved-${draft.revision}`;
    active -= 1;
    return result;
  });

  const one = queue.enqueue({ title: "t", body: "one", revision: 1 });
  const two = queue.enqueue({ title: "t", body: "two", revision: 2 });
  const three = queue.enqueue({ title: "t", body: "three", revision: 3 });
  first.resolve("saved-1");

  const outcomes = await Promise.all([one, two, three]);
  assert.equal(maximumActive, 1);
  assert.deepEqual(calls.map(({ revision }) => revision), [1, 3]);
  assert.ok(outcomes.every((outcome) => outcome?.draft.revision === 3));
});

test("discarding stale queued work lets an exact seal revision save after the active request", async () => {
  const activeSave = deferred();
  const order = [];
  const queue = new LatestSaveQueue(async (draft) => {
    order.push(`save-${draft.revision}-start`);
    if (draft.revision === 1) await activeSave.promise;
    order.push(`save-${draft.revision}-end`);
    return `saved-${draft.revision}`;
  });

  void queue.enqueue({ title: "t", body: "old", revision: 1 });
  void queue.enqueue({ title: "t", body: "stale", revision: 2 });
  queue.discardQueued();
  const idle = queue.waitForIdle();
  activeSave.resolve("done");
  await idle;
  const exact = await queue.enqueue({ title: "t", body: "latest", revision: 3 });
  order.push("seal");

  assert.equal(exact?.draft.revision, 3);
  assert.deepEqual(order, ["save-1-start", "save-1-end", "save-3-start", "save-3-end", "seal"]);
});

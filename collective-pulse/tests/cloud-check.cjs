const assert = require("node:assert/strict");
const load = require("./helpers/load-module.cjs");
const { campaignIsActive, createCloudConnection } = load("src/services/cloudConnection.js");
const { createResponseInput } = load("src/vote/responseInput.js");
const { createCloudApi } = load("src/services/cloudApi.js");
const { createInstallation } = load("src/installation/createInstallation.js");
const { appPath, assetUrl } = load("src/services/paths.js");

const campaign = {
  startMs: Date.parse("2026-09-21T00:00:00+07:00"),
  days: 7,
  openHour: 9,
  closeHour: 18,
};
const at = (date) => Date.parse(date + "+07:00");
assert.equal(campaignIsActive(campaign, at("2026-09-21T08:59:59")), false);
assert.equal(campaignIsActive(campaign, at("2026-09-21T09:00:00")), true);
assert.equal(campaignIsActive(campaign, at("2026-09-21T18:00:00")), false);
assert.equal(campaignIsActive(campaign, at("2026-09-22T02:00:00")), false);
assert.equal(campaignIsActive(campaign, at("2026-09-27T17:59:59")), true);
assert.equal(campaignIsActive(campaign, at("2026-09-27T18:00:00")), false);
assert.equal(campaignIsActive(campaign, at("2026-09-28T09:00:00")), false);
assert.equal(appPath("/vfcd-collective-pulse/vote/", "/vfcd-collective-pulse/"), "/vote");
assert.equal(
  appPath("/vfcd-collective-pulse/prompts/index.html", "/vfcd-collective-pulse/"),
  "/prompts/index.html",
);
assert.equal(assetUrl("axis.svg"), "/assets/axis.svg");

let inputTime = 0,
  enabled = true;
const batches = [];
const input = createResponseInput({
  now: () => inputTime,
  canVote: () => enabled,
  submit: (choices) => batches.push(choices),
});
input.press("one", 1);
input.release("one");
input.press("two", 1);
input.release("two");
input.press("three", -1);
inputTime = 1000;
input.sample();
assert.deepEqual(
  batches,
  [[1, 1, -1]],
  "Every tap must count; a fresh held press must not be counted twice",
);
inputTime = 2000;
input.sample();
assert.deepEqual(batches[1], [-1], "Holds must repeat once per second");
input.press("four", 1);
inputTime = 3000;
input.sample();
assert.deepEqual(batches[2], [1, -1], "Both directions can be held independently");
input.release("three");
input.release("four");
inputTime = 4000;
input.sample();
assert.equal(batches.length, 3, "Idle samples cannot create responses");
input.press("five", 1);
enabled = false;
inputTime = 5000;
input.sample();
enabled = true;
inputTime = 6000;
input.sample();
assert.equal(batches.length, 3, "Connection loss must clear queued presses and holds");
input.press("six", -1);
input.reset();
inputTime = 7000;
input.sample();
assert.equal(batches.length, 3, "Blur/cancellation must clear input");
input.press("seven", 1);
inputTime = 30000;
input.sample();
assert.deepEqual(batches[3], [1], "A suspended tab must not fabricate catch-up responses");

async function main() {
  const history = [],
    acknowledgements = [];
  let time = at("2026-09-21T12:00:00"),
    failRead = false,
    failSubmit = false,
    attempt = 0;
  const requests = [],
    reads = [];
  const scheduler = { setInterval: () => 1, clearInterval: () => {} };
  const api = {
    async getPulse(after, includeVotes) {
      reads.push(after);
      if (failRead) throw new Error("Offline");
      const votes = includeVotes ? history.filter((vote) => vote.id > after).slice(0, 2) : [];
      const cursor = votes.at(-1)?.id || after;
      return {
        serverNow: time,
        campaign,
        votes,
        cursor,
        hasMore: includeVotes && cursor < (history.at(-1)?.id || 0),
      };
    },
    async submitVotes(id, choices) {
      requests.push({ id, choices });
      if (failSubmit) throw new Error("Uncertain network response");
      return { votes: [{ id: 1, timestamp: time, choice: choices[0] }] };
    },
  };
  const connection = createCloudConnection({
    api,
    scheduler,
    clock: { now: () => time },
    newId: () => "request-" + ++attempt,
    onVotes: (votes, personal, live) => acknowledgements.push({ votes, personal, live }),
  });
  assert.equal(await connection.submit([1]), false, "Voting must wait for initial connectivity");
  await connection.syncOnce();
  assert.equal(connection.canVote(), true);
  assert.equal(acknowledgements[0].live, false, "Initial history must not animate as fresh votes");
  failSubmit = true;
  assert.equal(await connection.submit([1]), false);
  assert.equal(connection.canVote(), false);
  assert.equal(
    acknowledgements.some((entry) => entry.personal),
    false,
    "Unconfirmed responses must not reach the graph",
  );
  assert.equal(await connection.submit([-1]), false);
  assert.equal(requests.length, 1, "Offline presses must not be queued");
  failSubmit = false;
  await connection.syncOnce();
  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].id,
    requests[1].id,
    "Reconnect must retry only the uncertain request with its original ID",
  );
  assert.equal(acknowledgements.filter((entry) => entry.personal).length, 1);
  history.push(...Array.from({ length: 5 }, (_, i) => ({ id: i + 1, timestamp: time, choice: 1 })));
  await connection.syncOnce();
  assert.deepEqual(reads.slice(-3), [0, 2, 4], "Read all pages before waiting for the next poll");
  failRead = true;
  await connection.syncOnce();
  assert.equal(connection.canVote(), false);
  failRead = false;
  await connection.syncOnce();
  assert.equal(connection.canVote(), true);
  time = at("2026-09-21T18:00:00");
  assert.equal(connection.canVote(), false);

  let finish;
  const late = createCloudConnection({
    api: { getPulse: () => new Promise((resolve) => (finish = resolve)) },
    scheduler,
  });
  const reading = late.syncOnce();
  late.stop();
  finish({ serverNow: time, campaign, votes: [], cursor: 0, hasMore: false });
  await reading;
  assert.equal(
    late.getSnapshot().connected,
    false,
    "Responses arriving after teardown must be ignored",
  );

  const client = {
    rpc: (_name, _args) => ({
      abortSignal: async () => ({
        data: null,
        error: { code: "PT409", message: "Queue conflict" },
      }),
    }),
  };
  await assert.rejects(
    createCloudApi(client).updateQueue({}),
    (error) => error.status === 409 && error.message === "Queue conflict",
  );
  await assert.rejects(createCloudApi(null).getPulse(), /not been configured/);

  // Exercise the actual graph adapter when an acknowledgement and polling
  // deliver the same IDs in different orders. Local vote history stays intact.
  const saved = new Map([["collective_pulse_v5:2026-09-14", "local votes"]]);
  const storage = {
    getItem: (key) => saved.get(key) || null,
    setItem: (key, value) => saved.set(key, value),
  };
  const p = {
    windowWidth: 1920,
    windowHeight: 1080,
    createCanvas: () => ({ elt: { setAttribute() {} } }),
    pixelDensity() {},
    frameRate() {},
    textFont() {},
    strokeCap() {},
    strokeJoin() {},
    millis: () => 0,
    color: (value) => value,
    SQUARE: 0,
    MITER: 0,
  };
  const cloud = { canVote: () => true, submit: async () => true };
  const engine = createInstallation({ p, storage, cloud });
  engine.setup();
  const votes = [
    { id: 1, timestamp: engine.runtime.campaignStartMs + 10 * 3600000, choice: 1 },
    { id: 2, timestamp: engine.runtime.campaignStartMs + 10 * 3600000, choice: -1 },
  ];
  engine.applyCloudVotes([votes[1]], true);
  engine.applyCloudVotes(votes, false);
  engine.applyCloudVotes(votes, true);
  assert.equal(engine.runtime.derived.total, 2);
  assert.equal(engine.runtime.derived.yes, 1);
  assert.equal(engine.runtime.derived.no, 1);
  engine.persistence.saveState();
  assert.equal(saved.get("collective_pulse_v5:2026-09-14"), "local votes");
  assert.equal(
    engine.runtime.ripples.length,
    1,
    "Repeated delivery must not produce duplicate ripples",
  );
  engine.applyCloudVotes([{ id: 3, timestamp: votes[0].timestamp + 1000, choice: 1 }], false, true);
  assert.equal(engine.runtime.ripples.length, 2, "Fresh confirmed remote votes should animate");
  assert.equal(engine.runtime.derived.total, 3);
  console.log(
    "Cloud checks passed: repeated input, event hours, pagination, uncertain retries, offline pauses, stale responses, and graph deduplication.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

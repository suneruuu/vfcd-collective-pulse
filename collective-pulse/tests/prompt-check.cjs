const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { once } = require("node:events");
let createInstallationServer;
const Queue = require("./helpers/load-module.cjs")("shared/prompt-queue.js").default;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "collective-pulse-prompts-"));
const dataFile = path.join(temporary, ".pulse-data", "prompts.json");
fs.mkdirSync(path.join(temporary, "dist", "assets"), { recursive: true });
fs.mkdirSync(path.join(temporary, ".git"));
fs.writeFileSync(
  path.join(temporary, "dist", "index.html"),
  "<!doctype html><title>React frontend fixture</title>",
);
fs.writeFileSync(path.join(temporary, "dist", "assets", "frontend.js"), 'console.log("frontend");');
for (const file of ["README.md", "server.js", ".git/config"])
  fs.writeFileSync(path.join(temporary, file), "private source");
let now = 100000;
let server;
let base;
async function start() {
  server = createInstallationServer({ root: temporary, dataFile, clock: () => now });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = "http://127.0.0.1:" + server.address().port;
}
async function close() {
  await new Promise((resolve) => server.close(resolve));
}
async function post(route, body, headers = {}) {
  const response = await fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Collective-Pulse": "1", ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
async function get() {
  return (await fetch(base + "/api/prompts")).json();
}
async function main() {
  ({ createInstallationServer } = await import("../server.js"));
  await start();
  let document = await get();
  assert.equal(document.prompts.length, Queue.defaults.length);
  assert.equal(document.installation.online, false);
  assert.equal((await fetch(base + "/prompts")).status, 200);
  assert.equal((await fetch(base + "/prompts/")).status, 200);
  assert.equal((await fetch(base + "/")).status, 200);
  const asset = await fetch(base + "/assets/frontend.js");
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type"), /javascript/);
  assert.equal(await asset.text(), 'console.log("frontend");');
  assert.equal((await fetch(base + "/assets/frontend.js", { method: "HEAD" })).status, 200);
  for (const file of [
    "/.pulse-data/prompts.json",
    "/server.js",
    "/README.md",
    "/.git/config",
    "/assets/%2e%2e%2fserver.js",
  ])
    assert.equal(
      (await fetch(base + file)).status,
      404,
      "Private files must not be served: " + file,
    );
  assert.equal(
    (
      await post("/api/prompts", {
        revision: 0,
        operation: "add",
        text: "Offline next",
        position: "next",
      })
    ).status,
    409,
  );
  assert.equal(
    (await post("/api/prompts", { revision: 0, operation: "edit", id: "default-13", text: " " }))
      .status,
    400,
  );
  assert.equal(
    (
      await post("/api/prompts", {
        revision: 0,
        operation: "edit",
        id: "default-13",
        text: "x".repeat(241),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/api/prompts", {
        revision: 0,
        operation: "visibility",
        id: "default-13",
        hidden: "false",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/api/prompts", {
        revision: 0,
        operation: "reorder",
        ids: Array(Queue.defaults.length).fill("default-13"),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/prompts",
        { revision: 0, operation: "add", position: "bottom", text: "Unauthorized" },
        { Origin: "https://other.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal((await get()).revision, 0, "Rejected requests must leave persisted state unchanged");
  const unicode = "Ti\u1ebfng Vi\u1ec7t <script>alert(1)</script>";
  let edited = await post("/api/prompts", {
    revision: 0,
    operation: "edit",
    id: "default-13",
    text: unicode,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.prompts[0].text, unicode);
  document = edited.body;
  assert.equal(
    (
      await post("/api/prompts", {
        revision: 0,
        operation: "edit",
        id: "default-14",
        text: "Stale edit",
      })
    ).status,
    409,
  );
  const heartbeat = {
    revision: 1,
    currentId: "default-13",
    nextId: "default-14",
    active: true,
    campaignStartDate: "2026-09-14",
  };
  assert.equal((await post("/api/runtime", heartbeat)).status, 200);
  let added = await post("/api/prompts", {
    revision: 1,
    operation: "add",
    position: "next",
    text: "Next after current",
  });
  assert.equal(added.status, 200);
  assert.equal(added.body.prompts[1].text, "Next after current");
  assert.equal(
    (
      await post("/api/prompts", {
        revision: 2,
        operation: "add",
        position: "next",
        text: "Too early",
      })
    ).status,
    409,
    "Wait for display acknowledgement before another next insertion",
  );
  const nextId = added.body.prompts[1].id;
  assert.equal(
    (await post("/api/runtime", { ...heartbeat, revision: 2, currentId: null, nextId })).status,
    200,
  );
  added = await post("/api/prompts", {
    revision: 2,
    operation: "add",
    position: "next",
    text: "Before the first rotation",
  });
  assert.equal(added.status, 200);
  assert.equal(added.body.prompts[1].text, "Before the first rotation");
  let hidden = await post("/api/prompts", {
    revision: 3,
    operation: "visibility",
    id: "default-13",
    hidden: true,
  });
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.prompts[0].hidden, true);
  const reversed = hidden.body.prompts.map((prompt) => prompt.id).reverse();
  const reordered = await post("/api/prompts", {
    revision: 4,
    operation: "reorder",
    ids: reversed,
  });
  assert.equal(reordered.status, 200);
  assert.deepEqual(
    reordered.body.prompts.map((prompt) => prompt.id),
    reversed,
  );
  const concurrent = await Promise.all([
    post("/api/prompts", {
      revision: 5,
      operation: "add",
      position: "bottom",
      text: "Concurrent one",
    }),
    post("/api/prompts", {
      revision: 5,
      operation: "add",
      position: "bottom",
      text: "Concurrent two",
    }),
  ]);
  assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
  now += 15001;
  assert.equal((await get()).installation.online, false);
  assert.equal(
    (
      await post("/api/prompts", {
        revision: 6,
        operation: "add",
        position: "next",
        text: "Stale display",
      })
    ).status,
    409,
  );
  document = await get();
  await close();
  await start();
  assert.deepEqual((await get()).prompts, document.prompts, "Queue survives service restart");
  assert.equal((await get()).revision, 6);
  await checkDisplay();
  await close();
  fs.writeFileSync(dataFile, "invalid JSON");
  assert.throws(
    () => createInstallationServer({ dataFile }),
    /Cannot load question queue/,
    "Corrupt persistence must not silently reset the queue",
  );
  console.log(
    "Prompt queue checks passed: persistence, conflicts, private routes, live insertion, hidden questions, saved history, offline cache, and vote preservation.",
  );
}
async function checkDisplay() {
  const memory = {};
  const context = {
    console,
    Date,
    Math,
    Intl,
    Object,
    JSON,
    Array,
    Number,
    String,
    AbortSignal,
    fetch: (url, options) => fetch(base + url, options),
    floor: Math.floor,
    min: Math.min,
    max: Math.max,
    constrain: (value, low, high) => Math.min(high, Math.max(low, value)),
    millis: () => 1000,
    localStorage: {
      getItem: (key) => memory[key] || null,
      setItem: (key, value) => {
        memory[key] = value;
      },
    },
  };
  vm.createContext(context);
  require("./helpers/runtime-context.cjs").installContext(context);
  const run = (source) => vm.runInContext(source, context);
  const copy = (source) => JSON.parse(JSON.stringify(run(source)));
  run(
    'campaignStartMs = new Date(CONFIG.CAMPAIGN_START_DATE + "T00:00:00+07:00").getTime(); campaignEndMs = campaignStartMs + 7 * CONFIG.DAY_MS; state = createEmptyState(); state.votes = [[campaignStartMs + 43200000, YES]];',
  );
  const votes = copy("state.votes");
  run("appendPrompt(campaignStartMs + 43200000); appendPrompt(campaignStartMs + 43500000);");
  assert.equal(run("state.prompts.currentId"), "default-14");
  const queue = {
    version: 1,
    revision: 1,
    prompts: Queue.defaults.map((prompt) => ({ ...prompt })),
  };
  queue.prompts.splice(2, 0, { id: "inserted", text: "Inserted next", hidden: false });
  run("applyPromptQueue(" + JSON.stringify(queue) + ");");
  run("appendPrompt(campaignStartMs + 43800000);");
  assert.equal(run("state.prompts.currentId"), "inserted");
  queue.revision++;
  queue.prompts.reverse();
  const current = queue.prompts.find((prompt) => prompt.id === "inserted");
  current.text = "Edited current";
  run("applyPromptQueue(" + JSON.stringify(queue) + ");");
  assert.equal(
    run("PROMPTS[state.prompts.visible.at(-1)[0]]"),
    "Edited current",
    "Reordering must retain displayed question identity",
  );
  assert.deepEqual(copy("state.votes"), votes);
  current.hidden = true;
  queue.revision++;
  run("applyPromptQueue(" + JSON.stringify(queue) + ");");
  assert(!copy("state.prompts.visible").some(([index]) => queue.prompts[index].id === "inserted"));
  run("appendPrompt(campaignStartMs + 44100000);");
  assert.equal(
    run("state.prompts.currentId"),
    "default-14",
    "Continue after the hidden current question in reordered loop",
  );
  queue.prompts.forEach((prompt) => {
    prompt.hidden = true;
  });
  queue.revision++;
  run("applyPromptQueue(" + JSON.stringify(queue) + "); appendPrompt(campaignStartMs + 44400000);");
  assert.equal(
    run("state.prompts.visible.length"),
    0,
    "All hidden questions pause the loop safely",
  );
  assert.equal(run("nextManagedPromptIndex()"), -1);
  run(
    "saveState(); managedPrompts = PromptQueue.defaults.map(p => ({...p})); restorePromptQueueCache(); state = loadState();",
  );
  assert.equal(
    run("managedPrompts.length"),
    Queue.defaults.length + 1,
    "Offline reload uses cached managed queue",
  );
  assert.deepEqual(copy("state.votes"), votes);
  const blank = { version: 1, revision: 10, prompts: [] };
  run("applyPromptQueue(" + JSON.stringify(blank) + "); saveState(); state = loadState();");
  assert.equal(
    run("nextManagedPromptIndex()"),
    -1,
    "An empty queue must not produce NaN or an invalid prompt",
  );
  run(
    "managedPrompts = PromptQueue.defaults.map(p => ({...p})); PROMPTS = Object.freeze(managedPrompts.map(p=>p.text)); state = createEmptyState(); state.prompts.nextIndex = 1;",
  );
  const beforeFirst = { version: 1, revision: 11, prompts: Queue.defaults.map((p) => ({ ...p })) };
  beforeFirst.prompts.splice(1, 0, { id: "before-first", text: "First pending", hidden: false });
  run(
    "applyPromptQueue(" +
      JSON.stringify(beforeFirst) +
      "); appendPrompt(campaignStartMs + 45000000);",
  );
  assert.equal(
    run("state.prompts.currentId"),
    "before-first",
    "Add to next works before the first display rotation",
  );
  // Legacy numeric history must remap to stable default IDs on first managed load.
  run(
    "state = createEmptyState(); state.prompts.visible = [[1, campaignStartMs + 43200000]]; delete state.prompts.queueIds; state.prompts.currentId = null; saveState(); state = loadState();",
  );
  assert.equal(run("managedPrompts[state.prompts.visible[0][0]].id"), "default-14");
  run("state.votes = [[campaignStartMs + 43200000, YES]];");
  await run("syncPromptQueue();");
  assert.equal(run("promptQueueRevision"), 6, "Display fetches the actual persisted service queue");
  const live = (await get()).installation;
  assert.equal(live.online, true);
  assert.equal(live.revision, 6);
  const beforeOutage = copy("managedPrompts");
  context.fetch = async () => {
    throw new Error("Service offline");
  };
  await run("syncPromptQueue();");
  assert.deepEqual(
    copy("managedPrompts"),
    beforeOutage,
    "Service outage preserves the last received queue",
  );
  assert.deepEqual(copy("state.votes"), votes, "Sync and connection failures preserve votes");
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server?.listening) await close();
    const resolved = path.resolve(temporary);
    if (
      !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(resolved).startsWith("collective-pulse-prompts-")
    )
      throw new Error("Unsafe temporary cleanup target");
    fs.rmSync(resolved, { recursive: true, force: true });
  });

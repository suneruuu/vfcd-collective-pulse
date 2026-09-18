const assert = require("node:assert/strict");
const load = require("./helpers/load-module.cjs");
const Queue = load("shared/prompt-queue.js").default;
const { createQueueManager } = load("src/prompts/createQueueManager.js");
const { createPromptSynchronizer } = load("src/services/promptSynchronizer.js");
const { createExternalStore } = load("src/services/externalStore.js");
const { getConnectionStatus } = load("src/prompts/connectionStatus.js");
const { createInstallation } = load("src/installation/createInstallation.js");
const fixtures = load("tests/helpers/ui-fixture.jsx");
const document = (revision) => ({
  version: 1,
  revision,
  prompts: Queue.defaults.map((prompt) => ({ ...prompt })),
  installation: { online: true, revision, currentId: "default-13", active: true },
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function scheduler() {
  const timers = new Map();
  let id = 0;
  return {
    timers,
    setInterval(action) {
      timers.set(++id, action);
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    },
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function managerChecks() {
  let get = async () => document(0),
    update = async () => document(1),
    sent;
  const manager = createQueueManager({
    getQueue: (signal) => get(signal),
    updateQueue: (operation, signal) => {
      sent = operation;
      return update(operation, signal);
    },
  });
  await manager.refresh();
  const stale = deferred();
  get = () => stale.promise;
  const poll = manager.refresh();
  assert(await manager.mutate({ operation: "edit", id: "default-13", text: "Updated" }));
  assert.equal(sent.revision, 0);
  stale.resolve(document(0));
  await poll;
  assert.equal(
    manager.getSnapshot().queue.revision,
    1,
    "An older poll cannot overwrite a saved edit",
  );
  get = async () => document(2);
  update = async () => {
    throw Object.assign(new Error("Review the latest queue"), { status: 409 });
  };
  assert.equal(
    await manager.mutate({ operation: "edit", id: "default-13", text: "Conflict" }),
    false,
  );
  assert.equal(manager.getSnapshot().queue.revision, 2);
  assert.equal(manager.getSnapshot().busy, false);
  assert.equal(manager.getSnapshot().error, true);
  assert.equal(manager.getSnapshot().connected, true);
  update = async () => document(3);
  assert(await manager.move("default-13", 1));
  assert.deepEqual(sent.ids.slice(0, 2), ["default-14", "default-13"]);
  assert.equal(sent.revision, 2);
  get = async () => {
    throw new Error("Offline");
  };
  await manager.refresh();
  assert.equal(manager.getSnapshot().connected, false);
  assert.equal(
    manager.getSnapshot().queue.revision,
    3,
    "Offline errors keep the last queue visible",
  );
  assert.equal(
    await manager.mutate({ operation: "add", text: "Offline", position: "bottom" }),
    false,
  );
  manager.stop();

  const timers = scheduler(),
    requests = [];
  const remounted = createQueueManager(
    {
      getQueue: (signal) => {
        const pending = deferred();
        requests.push({ signal, ...pending });
        return pending.promise;
      },
    },
    timers,
  );
  remounted.start();
  remounted.start();
  assert.equal(timers.timers.size, 1);
  assert.equal(requests.length, 1);
  remounted.stop();
  assert.equal(timers.timers.size, 0);
  assert(requests[0].signal.aborted);
  remounted.start();
  assert.equal(requests.length, 2, "A React remount starts a new request immediately");
  requests[1].resolve(document(5));
  await flush();
  requests[0].resolve(document(0));
  await flush();
  assert.equal(remounted.getSnapshot().queue.revision, 5);
  remounted.stop();
  assert.equal(timers.timers.size, 0);

  // A conflict reload completing after unmount must not publish stale state.
  const conflict = deferred();
  let reads = 0;
  const stopped = createQueueManager({
    getQueue: () => (++reads === 1 ? Promise.resolve(document(0)) : conflict.promise),
    updateQueue: async () => {
      throw Object.assign(new Error("Conflict"), { status: 409 });
    },
  });
  await stopped.refresh();
  const saving = stopped.mutate({ operation: "edit", id: "default-13", text: "Conflict" });
  await flush();
  stopped.stop();
  const previous = stopped.getSnapshot();
  conflict.resolve(document(9));
  await saving;
  assert.equal(stopped.getSnapshot(), previous);
}
async function synchronizerChecks() {
  const timers = scheduler(),
    requests = [],
    applied = [],
    reported = [];
  let current = document(0);
  const installation = {
    getQueue: () => current,
    applyPromptQueue: (queue) => {
      current = queue;
      applied.push(queue);
    },
    getRuntimeStatus: () => ({
      revision: current.revision,
      currentId: "default-13",
      nextId: "default-14",
      active: true,
    }),
  };
  const api = {
    getQueue: (signal) => {
      const pending = deferred();
      requests.push({ signal, ...pending });
      return pending.promise;
    },
    reportRuntime: async (status) => reported.push(status),
  };
  const sync = createPromptSynchronizer({ api, installation, scheduler: timers });
  sync.start();
  sync.start();
  assert.equal(timers.timers.size, 1);
  assert.equal(requests.length, 1);
  sync.stop();
  assert(requests[0].signal.aborted);
  assert.equal(timers.timers.size, 0);
  sync.start();
  assert.equal(requests.length, 2);
  requests[1].resolve(document(3));
  await flush();
  requests[0].resolve(document(1));
  await flush();
  assert.equal(current.revision, 3);
  assert.equal(applied.length, 1);
  assert.equal(reported[0].revision, 3, "Report the revision actually applied by the display");
  const unchanged = sync.syncOnce();
  requests[2].resolve(document(3));
  await unchanged;
  assert.equal(applied.length, 1, "Unchanged polling must not rebuild the display");
  const outage = sync.syncOnce();
  requests[3].reject(new Error("Offline"));
  await outage;
  assert.equal(current.revision, 3);
  sync.stop();
  assert.equal(timers.timers.size, 0);
}
function navigationHelperChecks() {
  let now = 10_000;
  const clock = { now: () => now };
  const engine = createInstallation({ p: {}, storage: {}, clock });
  const { runtime, actions, navigationHelper } = engine;
  const advance = (milliseconds) => {
    now += milliseconds;
    navigationHelper.update();
  };
  advance(59_999);
  assert.equal(runtime.navigationHelperVisible, true);
  advance(1);
  assert.equal(runtime.navigationHelperVisible, false, "The helper closes after one idle minute");
  assert.equal(runtime.informationPanelVisible, true);

  actions.toggleNavigationHelper();
  advance(50_000);
  actions.interactNavigationHelper();
  advance(59_999);
  assert.equal(runtime.navigationHelperVisible, true, "Interaction starts a fresh idle minute");
  advance(1);
  assert.equal(runtime.navigationHelperVisible, false);

  actions.toggleNavigationHelper();
  actions.setNavigationHelperHovered(true);
  advance(180_000);
  assert.equal(runtime.navigationHelperVisible, true, "A stationary hover keeps the helper open");
  actions.setNavigationHelperHovered(false);
  advance(59_999);
  assert.equal(
    runtime.navigationHelperVisible,
    true,
    "Leaving the helper starts a fresh idle minute",
  );
  advance(1);
  assert.equal(runtime.navigationHelperVisible, false);

  actions.toggleNavigationHelper();
  advance(59_999);
  assert.equal(runtime.navigationHelperVisible, true, "Reopening resets the idle timer");
  actions.toggleNavigationHelper();
  actions.interactNavigationHelper();
  advance(60_000);
  assert.equal(runtime.navigationHelperVisible, false, "Interaction cannot reopen a closed helper");

  const open = fixtures.installationMarkup({ navigationHelperVisible: true });
  assert(/id="navigation-helper"[^>]*data-visible="true"[^>]*aria-hidden="false"/.test(open));
  assert(!/id="navigation-helper"[^>]*inert=""/.test(open));
}

function overviewScheduleChecks() {
  const { DISPLAY_SCHEDULE_DAYS, festivalDayAt } = load("src/schedule/domain.js");
  const now = new Date(DISPLAY_SCHEDULE_DAYS[2].date + "T12:00:00+07:00").getTime();
  const text = (markup, id) => markup.match(new RegExp('id="' + id + '"[^>]*>([^<]*)<'))?.[1];
  const render = (selectedOverviewDay) =>
    fixtures.installationMarkup({
      now,
      phase: "open",
      active: true,
      selectedOverviewDay,
    });
  for (const [dayIndex, day] of DISPLAY_SCHEDULE_DAYS.entries()) {
    const markup = render(dayIndex);
    assert.equal(text(markup, "schedule-weekday"), day.weekday);
    assert(markup.includes('id="schedule-date" dateTime="' + day.date + '"'));
    const firstVisible = day.events.find((event) => ![4, 5].includes(Number(event.track)));
    assert(markup.includes(firstVisible.title.replaceAll("&", "&amp;")));
    assert(!/class="schedule-card-track">Track [45]</.test(markup));
    assert.equal(/id="schedule-now"[^>]*hidden=""/.test(markup), dayIndex !== 2);
    assert(markup.includes('data-today="' + String(dayIndex === 2) + '"'));
  }
  const live = render(null);
  assert.equal(text(live, "schedule-weekday"), "Wednesday");
  assert(!/id="schedule-now"[^>]*hidden=""/.test(live));
  for (const invalid of [-1, 7, 1.5, "0", NaN]) {
    assert.equal(festivalDayAt(now, invalid), DISPLAY_SCHEDULE_DAYS[2]);
  }
}

function reactChecks() {
  const collapsed = fixtures.installationMarkup({ navigationHelperVisible: false });
  assert(
    /id="navigation-helper"[^>]*data-visible="false"[^>]*aria-hidden="true"[^>]*inert=""/.test(
      collapsed,
    ),
  );
  assert(!/id="navigation-helper"[^>]*hidden=""/.test(collapsed));
  assert(
    /id="panel-toggle"[^>]*aria-controls="navigation-helper"[^>]*aria-expanded="false"/.test(
      collapsed,
    ),
  );
  assert(!/id="festival-schedule"[^>]*hidden=""/.test(collapsed));
  assert(!/id="overview-days"[^>]*hidden=""/.test(collapsed));
  const queue = document(4);
  queue.prompts[0].text = "<script>alert(1)</script> & question";
  queue.prompts[1].hidden = true;
  const state = { queue, connected: true, busy: false, message: "Saved", error: false };
  let markup = fixtures.managerMarkup(state);
  assert(markup.includes("&lt;script&gt;alert(1)&lt;/script&gt; &amp; question"));
  assert(!markup.includes("<script>"));
  assert.equal((markup.match(/class="question-row/g) || []).length, Queue.defaults.length);
  assert(markup.includes("question-row is-hidden"));
  assert(markup.includes("question-row is-current"));
  const handles = [...markup.matchAll(/<button[^>]*class="drag-handle"[^>]*>.*?<\/button>/g)];
  assert.equal(handles.length, Queue.defaults.length);
  assert(handles.every(([handle]) => /<button[^>]*draggable="false"/.test(handle)));
  const icons = handles.map(([handle]) => handle.match(/<img[^>]*queue-drag\.svg[^>]*>/)?.[0]);
  assert.equal(icons.length, Queue.defaults.length);
  assert(icons.every((icon) => icon?.includes('draggable="false"')));

  assert.equal(getConnectionStatus(state).received, true);
  state.queue.installation.revision = 3;
  assert.equal(getConnectionStatus(state).received, false);
  markup = fixtures.managerMarkup(state);
  assert(/id="add-next"[^>]*disabled=""/.test(markup));
  assert(!/id="add-bottom"[^>]*disabled=""/.test(markup));
  state.connected = false;
  markup = fixtures.managerMarkup(state);
  assert(/id="add-bottom"[^>]*disabled=""/.test(markup));
  const store = createExternalStore({ count: 1 });
  let updates = 0;
  const unsubscribe = store.subscribe(() => updates++),
    snapshot = store.getSnapshot();
  store.publish({ count: 1 });
  assert.equal(updates, 0);
  assert.equal(store.getSnapshot(), snapshot);
  store.publish({ count: 2 });
  assert.equal(updates, 1);
  unsubscribe();
  store.publish({ count: 3 });
  assert.equal(updates, 1);
  const first = createInstallation({ p: {}, storage: {} }),
    second = createInstallation({ p: {}, storage: {} });
  first.runtime.pendingVotes.push(1);
  first.runtime.heldDirections.add(1);
  assert.equal(second.runtime.pendingVotes.length, 0);
  assert.equal(
    second.runtime.heldDirections.size,
    0,
    "Installation state belongs to each React mount",
  );
}
(async () => {
  await managerChecks();
  await synchronizerChecks();
  reactChecks();
  navigationHelperChecks();
  overviewScheduleChecks();
  console.log(
    "React component, isolated session, request cancellation, polling lifecycle, conflict, and stale response checks passed.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

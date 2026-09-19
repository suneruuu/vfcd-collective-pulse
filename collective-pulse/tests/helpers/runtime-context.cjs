const load = require("./load-module.cjs");
const Queue = load("shared/prompt-queue.js").default;
const { createInstallation } = load("src/installation/createInstallation.js");
const { createPromptApi } = load("src/services/promptApi.js");
const { createPromptSynchronizer } = load("src/services/promptSynchronizer.js");
const { PROMPT_CACHE_KEY } = load("src/services/queueCache.js");
const schedule = load("src/schedule/domain.js");
const fixtures = load("tests/helpers/ui-fixture.jsx");
function applySnapshot(context, snapshot) {
  const node = (id) => context.document?.getElementById(id);
  const attr = (id, name, value) => node(id)?.setAttribute(name, String(value));
  const text = (id, value) => {
    if (node(id)) node(id).textContent = value;
  };
  const screen = snapshot.timedScreen;
  if (screen) {
    if (node("campaign-screen")) node("campaign-screen").hidden = screen.hidden;
    attr("campaign-screen", "data-phase", screen.phase);
    attr("campaign-screen", "data-preview", snapshot.pulsePreview);
    node("campaign-screen")?.style.setProperty("--main-width", screen.mainWidth + "px");
    text("campaign-screen-label", screen.label);
    text("campaign-screen-value", screen.value);
    if (node("view-pulse")) node("view-pulse").hidden = screen.buttonHidden;
    attr("view-pulse", "aria-pressed", snapshot.pulsePreview);
    attr(
      "view-pulse",
      "aria-label",
      snapshot.pulsePreview ? "Return to timed screen" : "View recorded pulse",
    );
    text("view-pulse-label", snapshot.pulsePreview ? "Hide pulse" : "View pulse");
  }
  node("view-controls")?.style.setProperty(
    "--control-offset",
    snapshot.informationPanelVisible ? "0px" : "calc(455 * var(--sx))",
  );
  attr("view-controls", "data-waiting", !snapshot.active && !snapshot.pulsePreview);
  attr("view-controls", "data-phase", snapshot.phase);
  attr("view-controls", "data-helper-visible", snapshot.navigationHelperVisible);
  attr("festival-schedule", "data-phase", snapshot.phase);
  attr("view-live", "aria-pressed", snapshot.followLive);
  attr("view-fit", "aria-pressed", snapshot.fitAll);
  attr("navigation-helper", "data-visible", snapshot.navigationHelperVisible);
  attr("navigation-helper", "aria-hidden", !snapshot.navigationHelperVisible);
  if (node("navigation-helper"))
    node("navigation-helper").inert = !snapshot.navigationHelperVisible;
  attr("panel-toggle", "aria-expanded", snapshot.navigationHelperVisible);
  attr(
    "panel-toggle",
    "aria-label",
    snapshot.navigationHelperVisible ? "Hide navigation helper" : "Show navigation helper",
  );
  if (node("overview-days"))
    node("overview-days").hidden = !snapshot.informationPanelVisible || snapshot.before;
  snapshot.dayLabels.forEach((label, day) => {
    attr("overview-day-" + day, "aria-pressed", snapshot.selectedOverviewDay === day);
    attr("overview-day-" + day, "aria-label", label);
    attr("overview-day-" + day, "title", label);
  });
  text("vote-status", snapshot.status);
  if (node("festival-schedule"))
    node("festival-schedule").hidden = !snapshot.informationPanelVisible;
  if (snapshot.informationPanelVisible) {
    const day = schedule.festivalDayAt(snapshot.now, snapshot.selectedOverviewDay);
    text("schedule-weekday", day.weekday);
    text(
      "schedule-date",
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(day.date + "T00:00:00+07:00")),
    );
    const date = schedule.vietnamScheduleDate(snapshot.now);
    attr("festival-schedule", "data-today", date === day.date);
    text(
      "schedule-status",
      date < day.date ? "Upcoming" : date > day.date ? "Festival ended" : "Today",
    );
    if (node("schedule-events"))
      node("schedule-events").innerHTML = fixtures.scheduleMarkup(
        snapshot.now,
        true,
        snapshot.selectedOverviewDay,
      );
  }
}
exports.installContext = (context) => {
  const installation = createInstallation({
    p: context,
    storage: context.localStorage,
    documentRef: context.document,
    clock: context.Date || Date,
    pixelRatio: context.window?.devicePixelRatio || 1,
    onSnapshot: (snapshot) => applySnapshot(context, snapshot),
    focusCanvas: () => context.document?.querySelector?.("canvas")?.focus(),
  });
  for (const [name, value] of Object.entries(installation.constants)) context[name] = value;
  for (const name of Object.keys(installation.runtime))
    Object.defineProperty(context, name, {
      configurable: true,
      get: () => installation.runtime[name],
      set: (value) => {
        installation.runtime[name] = value;
      },
    });
  for (const group of [
    "campaign",
    "formatting",
    "persistence",
    "voting",
    "viewport",
    "phase",
    "camera",
    "prompts",
    "input",
    "renderer",
    "controller",
  ])
    Object.assign(context, installation[group]);
  const setup = () => {
    installation.setup();
    const handlers = {
      "view-zoom-in": "zoomIn",
      "view-zoom-out": "zoomOut",
      "view-live": "live",
      "view-fit": "fit",
      "panel-toggle": "toggleNavigationHelper",
      "view-pulse": "togglePreview",
    };
    for (const [id, action] of Object.entries(handlers))
      context.document?.getElementById(id)?.addEventListener("click", installation.actions[action]);
    for (let day = 0; day < context.CONFIG.CAMPAIGN_DAYS; day++)
      context.document
        ?.getElementById("overview-day-" + day)
        ?.addEventListener("click", () => installation.actions.selectDay(day));
  };
  const api = createPromptApi((...args) => context.fetch(...args));
  const sync = createPromptSynchronizer({ api, installation });
  Object.assign(context, {
    PromptQueue: Queue,
    PROMPT_CACHE_KEY,
    setup,
    draw: installation.draw,
    windowResized: installation.windowResized,
    applyPromptQueue: installation.applyPromptQueue,
    restorePromptQueueCache: installation.restorePromptQueueCache,
    syncPromptQueue: sync.syncOnce,
  });
  return installation;
};

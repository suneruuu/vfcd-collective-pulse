const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseSchedule, plainText } = require("../scripts/read-schedule.cjs");
const project = path.join(__dirname, "..");
const load = require("./helpers/load-module.cjs");
const domain = load("src/schedule/domain.js");
const { FESTIVAL_SCHEDULE } = load("src/schedule/data.js");
const fixtures = load("tests/helpers/ui-fixture.jsx");
const html = fixtures.scheduleMarkup(new Date("2026-09-14T12:00:00+07:00").getTime());
const css = fs.readFileSync(path.join(project, "src/styles/installation.css"), "utf8");
const context = { ...domain, FESTIVAL_SCHEDULE };
vm.createContext(context);
const run = (code) => vm.runInContext(code, context);
const serialize = (value) => JSON.parse(JSON.stringify(value));
const data = serialize(run("FESTIVAL_SCHEDULE"));
assert.equal(data.source, "https://vfcd.events/schedule/");
assert.deepEqual(
  data.days.map((day) => day.date),
  Array.from({ length: 7 }, (_, i) => `2026-09-${21 + i}`),
);
assert.equal(data.days.flatMap((day) => day.events).length, 37);
const displayedDays = serialize(run("DISPLAY_SCHEDULE_DAYS"));
assert.deepEqual(
  displayedDays.map((day) => day.date),
  Array.from({ length: 7 }, (_, i) => `2026-09-${14 + i}`),
);
assert.deepEqual(
  displayedDays.map((day) => day.sourceDate),
  data.days.map((day) => day.date),
);
assert.deepEqual(
  displayedDays.map((day) => day.weekday),
  data.days.map((day) => day.weekday),
);
assert.deepEqual(
  serialize(run('festivalDisplayDays("2026-09-21")')).map((day) => day.date),
  data.days.map((day) => day.date),
  "The real week must be restorable through the same start-date setting",
);
assert.equal(
  data.days[5].events.find((event) => event.id === "11011").title,
  "Mạch Ngầm [counter-place]",
);
assert.equal(data.days[1].events.find((event) => event.id === "10020").title, "22＋1");
for (const day of data.days) {
  assert.equal(
    new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(day.date),
    ),
    day.weekday,
  );
  const timeline = domain.buildScheduleTimeline(day);
  const sessions = [...timeline.nina, ...timeline.satellite];
  assert.equal(
    sessions.length,
    day.events.reduce((count, event) => count + (event.sessions?.length ?? 1), 0),
  );
  assert.equal(new Set(sessions.map((event) => event.sessionKey)).size, sessions.length);
  for (const event of sessions) {
    assert(event.x >= 0 && event.width > 0 && event.x + event.width <= 386 + 1e-9);
    assert(event.y >= 14 && event.y < timeline.height);
  }
  for (const lane of [timeline.nina, timeline.satellite]) {
    assert(lane.every((event, index) => index === 0 || event.y > lane[index - 1].y));
  }
  const markup = fixtures.timelineMarkup(timeline);
  assert.equal((markup.match(/class="schedule-card"/g) ?? []).length, sessions.length);
  assert.equal((markup.match(/class="schedule-event-bar"/g) ?? []).length, sessions.length);
}
const tuesday = serialize(run("buildScheduleTimeline(FESTIVAL_SCHEDULE.days[1])"));
const forum = tuesday.nina.filter((event) => event.id === "10985");
assert.deepEqual(
  forum.map(({ start, end }) => [start, end]),
  [
    ["09:00", "11:30"],
    ["13:30", "16:00"],
  ],
);
const wednesday = serialize(run("buildScheduleTimeline(FESTIVAL_SCHEDULE.days[2])"));
assert.equal(wednesday.nina.find((event) => event.id === "11004").end, null);

assert.equal(plainText("<b>Mạch Ngầm</b> &amp; 22&#xff0b;1"), "Mạch Ngầm & 22＋1");

// Render the real React components and exercise the scroll controller independently.
const at = (time, visible = true) => fixtures.scheduleMarkup(new Date(time).getTime(), visible);
const text = (markup, id) => markup.match(new RegExp('id="' + id + '"[^>]*>([^<]*)<'))?.[1];
const markerHidden = (markup) => /id="schedule-now"[^>]*hidden=""/.test(markup);
let markup = at("2026-09-13T12:00:00+07:00");
assert.equal(text(markup, "schedule-weekday"), "Monday");
assert.equal(text(markup, "schedule-date"), "14 September 2026");
assert.equal(text(markup, "schedule-status"), "Upcoming");
assert(markerHidden(markup));
assert(markerHidden(at("2026-09-14T07:00:00+07:00")));
markup = at("2026-09-14T09:30:00+07:00");
assert.equal(text(markup, "schedule-status"), "Today");
assert(!markerHidden(markup));
assert(markup.includes("--now-x:52.63636363636363"));
assert(/id="festival-schedule"[^>]*hidden=""/.test(at("2026-09-14T12:00:00+07:00", false)));
assert(markerHidden(at("2026-09-14T23:59:59+07:00")));
markup = at("2026-09-15T00:00:00+07:00");
assert.equal(text(markup, "schedule-weekday"), "Tuesday");
assert(markup.includes("13:30") && markup.includes("16:00"));
markup = at("2026-09-16T12:00:00+07:00");
assert.equal(text(markup, "schedule-weekday"), "Wednesday");
assert.equal(text(markup, "schedule-date"), "16 September 2026");
assert.equal(text(markup, "schedule-status"), "Today");
assert(!markerHidden(markup));
assert(markup.includes("Cholon Urban Walk"));
assert.equal(
  domain.festivalDayAt(new Date("2026-09-16T12:00:00+07:00").getTime()).sourceDate,
  "2026-09-23",
);
markup = at("2026-09-21T12:00:00+07:00");
assert.equal(text(markup, "schedule-weekday"), "Sunday");
assert.equal(text(markup, "schedule-status"), "Festival ended");
assert(markerHidden(markup));
// The reference day places bars proportionally across 09:00-19:00.
const referenceDay = {
  ...data.days[0],
  events: data.days[0].events.filter((event) => event.id !== "10990"),
};
const reference = domain.buildScheduleTimeline(referenceDay);
assert.equal(reference.startMinute, 540);
assert.equal(reference.endMinute, 1140);
assert.equal(reference.ticks.length, 11);
assert.equal(reference.ticks[0].label, "09:00");
assert.equal(reference.ticks.at(-1).label, "19:00");
assert.equal(reference.nina[0].x, 0);
assert(Math.abs(reference.nina[0].width - 347.4) < 1e-9);
assert(Math.abs(reference.nina[1].x - 154.4) < 1e-9);
assert(Math.abs(reference.satellite[0].width - 77.2) < 1e-9);
assert.equal(reference.ninaHeight, 155);
assert.equal(reference.gridWidth, 388);
assert.deepEqual(reference.gridOffsets, [0]);
const earlyDay = domain.buildScheduleTimeline(data.days[2]);
assert.equal(earlyDay.ticks[0].label, "06:00");
assert.equal(earlyDay.ticks.at(-1).label, "19:00");
assert(earlyDay.ticks.length <= 11, "Long days keep the time labels readable");
assert(
  earlyDay.gridWidth < 388 && earlyDay.gridOffsets.length === 2,
  "Hour rules scale with extended time ranges",
);
assert.equal(domain.scheduleMarkerX(reference, 540), 0);
assert.equal(domain.scheduleMarkerX(reference, 840), 193);
assert.equal(domain.scheduleMarkerX(reference, 1140), 386);
assert.equal(domain.scheduleMarkerX(reference, 0), 0);
assert.equal(domain.scheduleMarkerX(reference, 1440), 386);
assert.equal(
  domain.buildScheduleTimeline(data.days[2]).startMinute,
  360,
  "Early events extend the timeline",
);
assert(domain.buildScheduleTimeline(data.days[2]).height > 333, "Busy days remain scrollable");
const unknownEnd = domain
  .buildScheduleTimeline(data.days[2])
  .nina.find((event) => event.id === "11004");
assert.equal(unknownEnd.end, null, "A visual bar must not invent a published end time");
assert(unknownEnd.width > 0);
const empty = domain.buildScheduleTimeline({ events: [] });
assert.equal(empty.nina.length + empty.satellite.length, 0);
assert.equal(empty.height, 333);
assert(markup.includes("schedule-live.svg"));
for (const asset of [
  "schedule-timeline-grid.svg",
  "schedule-timeline-now.svg",
  "schedule-venue-rule.svg",
]) {
  assert(html.includes(asset));
}
const unsafe = fixtures.scheduleCardMarkup({
  ...data.days[0].events[0],
  title: "<script>alert(1)</script>",
  venue: 'Nina Next Space " onmouseover="alert(1)',
});
assert(!unsafe.includes("<script>"));
assert(unsafe.includes("&lt;script&gt;"));
assert(!unsafe.includes(' onmouseover="'));

// Validate the HTML reader without network access, including whitespace and UTF-8.
const fixture = data.days
  .map(
    (day, index) => `<div>${day.weekday}, ${21 + index} September</div>
  <div class="jet-listing-grid__item" data-post-id="${index + 1}">
  <h5>Mạch Ngầm &amp; 22&#xff0b;1</h5><div class="elementor-heading-title"> 09:00 </div>
  <p><strong>Track 03:</strong> Satellite</p><p><strong>Venue:</strong> Nguyễn Art Foundation</p>`,
  )
  .join("");
const parsed = parseSchedule(fixture);
assert.equal(parsed.days.length, 7);
assert.equal(parsed.days[0].events[0].title, "Mạch Ngầm & 22＋1");
assert.equal(parsed.days[0].events[0].end, null);
assert.throws(() => parseSchedule("<html>No schedule available</html>"), /seven festival dates/);
assert.throws(
  () => parseSchedule(fixture.replace("<h5>Mạch Ngầm &amp; 22&#xff0b;1</h5>", "<h5></h5>")),
  /Incomplete event/,
);

// Explicit parent/leaf geometry, including a non-square resize; not browser QA.
function declaration(selector, property, width, height) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]+)\\}`))?.[1];
  assert(body, `Missing schedule sizing rule ${selector}`);
  const value = body.match(new RegExp(`(?:^|\\n)\\s*${property}: ([^;]+);`))?.[1];
  assert(value, `Missing ${selector} ${property}`);
  const scales = { sx: width / 1920, sy: height / 1080, ui: Math.min(width / 1920, height / 1080) };
  const expression = value
    .replace(/calc\((.*)\)/, "$1")
    .replace(/var\(--(sx|sy|ui)\)/g, (_, key) => scales[key]);
  assert(/^[\d.\s*+\-/()]+$/.test(expression));
  return Function(`return (${expression})`)();
}
for (const [width, height] of [
  [1920, 1080],
  [960, 540],
  [1440, 1080],
]) {
  const sx = width / 1920,
    sy = height / 1080,
    ui = Math.min(sx, sy);
  for (const [selector, expectedWidth, expectedHeight] of [
    ["#festival-schedule", 455 * sx, 430 * sy],
    [".schedule-live-icon", 20 * ui, 20 * ui],
    [".schedule-grid", 388 * sx, 333 * sy],
    [".schedule-venue-rule", 435 * sx, 2 * sy],
    ["#schedule-scroll", 435 * sx, 333 * sy],
    ["#schedule-now", 0, 356 * sy],
    ["#schedule-now img", 362.333 * sy, 10.6667 * sx],
  ]) {
    assert.equal(declaration(selector, "width", width, height), expectedWidth);
    assert.equal(declaration(selector, "height", width, height), expectedHeight);
  }
  assert.equal(declaration("#festival-schedule", "left", width, height), 1465 * sx);
  assert.equal(declaration("#schedule-now img", "left", width, height), -181.1665 * sy);
}
assert(css.includes("transform: rotate(-90deg)"));
console.log(
  "Collective Pulse official schedule, Vietnam timing, timeline placement, session coverage, safe markup, and Figma sizing checks passed.",
);

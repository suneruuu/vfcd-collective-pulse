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
const { createScheduleFollower } = load("src/schedule/follower.js");
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
  const agenda = serialize(
    run(`buildScheduleAgenda(FESTIVAL_SCHEDULE.days[${data.days.indexOf(day)}])`),
  );
  assert(
    agenda.rows.every(
      (row, index) =>
        index === 0 || row.y === agenda.rows[index - 1].y + agenda.rows[index - 1].height,
    ),
  );
  const sessions = agenda.rows.flatMap((row) => [...row.nina, ...row.satellite]);
  assert.equal(
    sessions.length,
    day.events.reduce((count, event) => count + (event.sessions?.length ?? 1), 0),
  );
  const markup = fixtures.agendaMarkup(domain.buildScheduleAgenda(day));
  assert.equal((markup.match(/class="schedule-card"/g) ?? []).length, sessions.length);
}
const tuesday = serialize(run("buildScheduleAgenda(FESTIVAL_SCHEDULE.days[1])"));
const forum = tuesday.rows.flatMap((row) => row.nina).filter((event) => event.id === "10985");
assert.deepEqual(
  forum.map(({ start, end }) => [start, end]),
  [
    ["09:00", "11:30"],
    ["13:30", "16:00"],
  ],
);
const wednesday = serialize(run("buildScheduleAgenda(FESTIVAL_SCHEDULE.days[2])"));
assert.equal(
  wednesday.rows.flatMap((row) => row.nina).find((event) => event.id === "11004").end,
  null,
);

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
assert(markup.includes("--now-y:calc(193.5 * var(--sy))"));
assert(/id="festival-schedule"[^>]*hidden=""/.test(at("2026-09-14T12:00:00+07:00", false)));
assert(markerHidden(at("2026-09-14T23:59:59+07:00")));
markup = at("2026-09-15T00:00:00+07:00");
assert.equal(text(markup, "schedule-weekday"), "Tuesday");
assert(markup.includes("13:30"));
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
const agenda = domain.buildScheduleAgenda(domain.DISPLAY_SCHEDULE_DAYS[0]);
const follower = createScheduleFollower();
const follow = (time, clientHeight = 251, date = "2026-09-14", today = true) => {
  const now = new Date(time).getTime();
  const minute = ((now + 7 * 3600000) % 86400000) / 60000;
  return follower.target({
    now,
    date,
    today,
    clientHeight,
    markerY: domain.scheduleMarkerY(agenda, minute),
  });
};
assert.equal(follow("2026-09-13T12:00:00+07:00", 251, "2026-09-14", false), 0);
assert.equal(follow("2026-09-14T09:30:00+07:00"), 132);
assert.equal(
  follow("2026-09-14T09:30:01+07:00"),
  null,
  "Do not reset scrolling on every clock tick",
);
follower.pause(new Date("2026-09-14T09:30:05+07:00").getTime());
assert.equal(follow("2026-09-14T09:30:10+07:00"), null);
assert.equal(
  follow("2026-09-14T09:30:34+07:00"),
  null,
  "Manual browsing pauses for thirty seconds",
);
assert(follow("2026-09-14T09:31:00+07:00") > 132);
const resizedAt = new Date("2026-09-14T09:31:01+07:00").getTime();
const halfSizeY = domain.scheduleMarkerY(agenda, ((resizedAt + 7 * 3600000) % 86400000) / 60000);
assert.equal(follow("2026-09-14T09:31:01+07:00", 125.5), (halfSizeY - 61.5) * 0.5);
follower.pause(resizedAt);
assert.equal(
  follow("2026-09-15T00:00:00+07:00", 251, "2026-09-15"),
  0,
  "Changing day resets manual browsing",
);
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
    ["#festival-schedule", 455 * sx, 409 * sy],
    [".schedule-live-icon", 20 * ui, 20 * ui],
    [".schedule-column-rule", 2 * sx, 251 * sy],
    [".schedule-column-rule img", 251 * sy, 2 * sx],
    ["#schedule-now", 377 * sx, 0],
    ["#schedule-now img", 383.333 * sx, 10.6667 * sy],
    [".schedule-card", 159 * sx, 122 * sy],
  ]) {
    assert.equal(declaration(selector, "width", width, height), expectedWidth);
    assert.equal(declaration(selector, "height", width, height), expectedHeight);
  }
  assert.equal(declaration("#festival-schedule", "left", width, height), 1465 * sx);
  assert.equal(declaration("#schedule-now img", "left", width, height), -5.33333 * sx);
  assert.equal(declaration("#schedule-now img", "top", width, height), -5.33333 * sy);
}
assert(css.includes("transform: translate(-50%, -50%) rotate(90deg)"));
console.log(
  "Collective Pulse official schedule, Vietnam timing, scrolling, safe markup, and Figma sizing checks passed.",
);

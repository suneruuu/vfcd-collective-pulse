const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const project = path.join(__dirname, "..");
const load = require("./helpers/load-module.cjs");
const domain = load("src/schedule/domain.js");
const { FESTIVAL_SCHEDULE: data } = load("src/schedule/data.js");
const fixtures = load("tests/helpers/ui-fixture.jsx");
const html = fixtures.scheduleMarkup(new Date("2026-09-14T12:00:00+07:00").getTime());
const css = fs.readFileSync(path.join(project, "src/styles/installation.css"), "utf8");
assert.equal(
  data.source,
  "https://www.figma.com/design/nFZuVD1N9s30u72fi6eyIW/VFCD-Installation?node-id=191-4576",
);
assert(
  !fs.existsSync(path.join(project, "scripts/read-schedule.cjs")),
  "The website reader must not remain a schedule source",
);
assert.deepEqual(
  data.days.map((day) => day.date),
  Array.from({ length: 7 }, (_, i) => `2026-09-${21 + i}`),
);
assert.deepEqual(
  data.days.map((day) => day.nodeId),
  ["191:4529", "191:4217", "191:4268", "191:4324", "191:4372", "191:4416", "191:4471"],
);
// Event captions and coordinates are transcribed from the seven supplied design panels.
const expectedTitles = [
  [
    "Exhibition: Living Festival",
    "VFCD Opening Ceremony & Key Note",
    "Street Objects & The New Comfort",
  ],
  [
    "Exhibition: Living Festival",
    "Forum: Festival Futures Forwards",
    "Living in the BLANK",
    "22＋1",
  ],
  [
    "Exhibition: Living Festival",
    "Living Threads - Fragmented Scrolls: Reflective Needlecraft in the Cracks of Everyday Life",
    "Short Film Session",
    "The Design Intelligence Lab: Codifying Design Intelligence through Cross-Cultural Architectural Practice",
    "The Lab: An Evolving Practice",
  ],
  ["Exhibition: Living Festival", "Design Is a Verb", "Learning [From] Everyday"],
  [
    "Exhibition: Living Festival",
    "Reviving Urban Memory: Adaptive Reuse and the Living City at Tempo Nexus",
  ],
  [
    "Exhibition: Living Festival",
    "Experimental Digital Arts",
    "Creative Expression Session",
    "Hao Si Phuong Gallery",
    "Mạch Ngầm [counter-place]",
  ],
  [
    "Exhibition: Living Festival",
    "Performance Art",
    "Urban Art",
    "Breathe The Idea: The thinking, making and shaping behind VFCD’s visual identity",
    "Invisible Reflection",
    "Living Space: How Architecture Shapes the Way We Live",
  ],
];
const expectedBars = [
  [
    [0, 14, 348],
    [156, 53, 154],
    [39, 169, 77],
  ],
  [
    [0, 14, 350],
    [0, 53, 311],
    [40, 169, 76],
    [270, 226, 78],
  ],
  [
    [0, 14, 348],
    [58, 53, 58],
    [252, 53, 59],
    [195, 109, 116],
    [39, 169, 116],
    [193, 242, 78],
  ],
  [
    [0, 14, 348],
    [39, 169, 77],
    [193, 208, 78],
  ],
  [
    [0, 14, 346],
    [39, 169, 77],
  ],
  [
    [0, 14, 346],
    [39, 53, 115],
    [193, 92, 116],
    [39, 169, 115],
    [193, 209, 75],
  ],
  [
    [0, 14, 346],
    [39, 53, 115],
    [194, 92, 115],
    [309, 131, 78],
    [39, 203, 77],
    [193, 243, 78],
  ],
];
assert.equal(data.days.flatMap((day) => day.events).length, 28);
const displayedDays = domain.DISPLAY_SCHEDULE_DAYS;
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
  domain.festivalDisplayDays("2026-09-21").map((day) => day.date),
  data.days.map((day) => day.date),
  "The real week remains controlled by the shared start-date setting",
);
for (const [index, day] of data.days.entries()) {
  assert.equal(
    new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(day.date),
    ),
    day.weekday,
  );
  assert.deepEqual(
    day.events.map((event) => event.title),
    expectedTitles[index],
  );
  const timeline = domain.buildScheduleTimeline(day);
  const events = [...timeline.nina, ...timeline.satellite];
  assert.equal(events.length, day.events.length);
  assert.equal(new Set(events.map((event) => event.sessionKey)).size, events.length);
  const bars = events.flatMap((event) =>
    (event.bars ?? [{ x: event.x, width: event.width }]).map((bar) => [bar.x, event.y, bar.width]),
  );
  assert.deepEqual(
    bars,
    expectedBars[index],
    "Day " + (index + 1) + " must preserve the Figma time bars",
  );
  assert.deepEqual(
    timeline.ticks.map((tick) => tick.label),
    Array.from({ length: 11 }, (_, hour) => String(9 + hour).padStart(2, "0") + ":00"),
  );
  assert.equal(timeline.ninaHeight, index === 6 ? 189 : 155);
  assert.equal(timeline.height, 333, "All Figma days fit the panel");
  for (const event of events) {
    assert(![4, 5].includes(Number(event.track)));
    assert(event.x >= 0 && event.width > 0 && event.x + event.width <= 388);
    assert(event.y >= 14 && event.y < timeline.height);
  }
  for (const lane of [timeline.nina, timeline.satellite])
    assert(lane.every((event, i) => i === 0 || event.y > lane[i - 1].y));
  const markup = fixtures.timelineMarkup(timeline);
  assert.equal((markup.match(/class="schedule-card"/g) ?? []).length, events.length);
  assert.equal((markup.match(/class="schedule-event-bar"/g) ?? []).length, bars.length);
  const panel = fixtures.scheduleMarkup(
    new Date("2026-09-16T12:00:00+07:00").getTime(),
    true,
    index,
  );
  assert(panel.includes(data.source.replace(/&/g, "&amp;")));
  assert(!panel.includes("vfcd.events/schedule"));
}
const tuesday = domain.buildScheduleTimeline(data.days[1]);
assert.deepEqual(tuesday.nina.find((event) => event.track === 2).sessions, undefined);
assert.deepEqual([tuesday.nina[1].start, tuesday.nina[1].end], ["09:00", "17:00"]);
const wednesday = domain.buildScheduleTimeline(data.days[2]);
const needlecraft = wednesday.nina[1];
assert.deepEqual(needlecraft.sessions, [
  { start: "10:30", end: "12:00" },
  { start: "15:30", end: "17:00" },
]);
const needlecraftMarkup = fixtures.scheduleCardMarkup(needlecraft);
assert.equal((needlecraftMarkup.match(/class="schedule-event-bar"/g) ?? []).length, 2);
assert.equal((needlecraftMarkup.match(/class="schedule-card-title"/g) ?? []).length, 1);
assert(needlecraftMarkup.includes("10:30") && needlecraftMarkup.includes("15:30"));
assert.equal(wednesday.nina[2].title, "Short Film Session");
assert.equal(wednesday.nina[2].end, "17:00");

// Vietnam timing, overview selection, and the real-time marker remain independent of the design copy.
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
assert(markup.includes("--now-x:19.3"));
assert(/id="festival-schedule"[^>]*hidden=""/.test(at("2026-09-14T12:00:00+07:00", false)));
assert(markerHidden(at("2026-09-14T23:59:59+07:00")));
markup = at("2026-09-15T00:00:00+07:00");
assert.equal(text(markup, "schedule-weekday"), "Tuesday");
assert(markup.includes("Forum: Festival Futures Forwards"));
markup = at("2026-09-16T12:00:00+07:00");
assert.equal(text(markup, "schedule-weekday"), "Wednesday");
assert.equal(text(markup, "schedule-date"), "16 September 2026");
assert.equal(text(markup, "schedule-status"), "Today");
assert(!markerHidden(markup));
assert(markup.includes("Short Film Session"));
assert(!markup.includes("Cholon Urban Walk"));
assert.equal(
  domain.festivalDayAt(new Date("2026-09-16T12:00:00+07:00").getTime()).sourceDate,
  "2026-09-23",
);
markup = at("2026-09-21T12:00:00+07:00");
assert.equal(text(markup, "schedule-weekday"), "Sunday");
assert.equal(text(markup, "schedule-status"), "Festival ended");
assert(markerHidden(markup));
const reference = domain.buildScheduleTimeline(data.days[0]);
assert.equal(reference.startMinute, 540);
assert.equal(reference.endMinute, 1140);
assert.equal(reference.gridWidth, 388);
assert.deepEqual(reference.gridOffsets, [0]);
assert.equal(domain.scheduleMarkerX(reference, 540), 0);
assert.equal(domain.scheduleMarkerX(reference, 840), 193);
assert.equal(domain.scheduleMarkerX(reference, 1140), 386);
assert.equal(domain.scheduleMarkerX(reference, 0), 0);
assert.equal(domain.scheduleMarkerX(reference, 1440), 386);
const hiddenTracks = domain.buildScheduleTimeline({
  events: [4, 5].map((track) => ({ ...data.days[0].events[0], track, start: "06:00" })),
});
assert.equal(hiddenTracks.nina.length + hiddenTracks.satellite.length, 0);
assert.equal(hiddenTracks.startMinute, 540);
const empty = domain.buildScheduleTimeline({ events: [] });
assert.equal(empty.nina.length + empty.satellite.length, 0);
assert.equal(empty.height, 333);
assert(markup.includes("schedule-live.svg"));
for (const asset of [
  "schedule-timeline-grid.svg",
  "schedule-timeline-now.svg",
  "schedule-venue-rule.svg",
])
  assert(html.includes(asset));
const unsafe = fixtures.scheduleCardMarkup({
  ...data.days[0].events[0],
  title: "<script>alert(1)</script>",
  venue: 'Nina Next Space " onmouseover="alert(1)',
});
assert(!unsafe.includes("<script>"));
assert(unsafe.includes("&lt;script&gt;"));
assert(!unsafe.includes(' onmouseover="'));

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
    ["#schedule-scroll", 444 * sx, 333 * sy],
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
  "Collective Pulse Figma schedule, Vietnam timing, daily layout, session coverage, safe markup, and sizing checks passed.",
);

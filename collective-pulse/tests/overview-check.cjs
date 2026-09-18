const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const project = path.join(__dirname, "..");
const events = [];
let now = new Date("2026-09-16T12:00:00+07:00").getTime();
class TestDate extends Date {
  static now() {
    return now;
  }
}
const context = {
  console,
  Math,
  Date: TestDate,
  Intl,
  width: 1920,
  height: 1080,
  HALF_PI: Math.PI / 2,
  LEFT: "left",
  TOP: "top",
  BOLD: "bold",
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  constrain: (value, lower, upper) => Math.min(upper, Math.max(lower, value)),
  loadImage: (source) => {
    assert(fs.existsSync(path.join(project, "public", source)), `Missing asset ${source}`);
    return { source };
  },
  image: (asset, ...args) => {
    assert(asset?.source, "Every decoration must use a loaded Figma asset");
    events.push({ type: "image", source: asset.source, args });
  },
  drawingContext: {},
};
for (const type of [
  "stroke",
  "strokeWeight",
  "line",
  "circle",
  "text",
  "textSize",
  "textStyle",
  "textAlign",
  "fill",
  "noStroke",
  "push",
  "pop",
  "translate",
  "rotate",
]) {
  context[type] = (...args) => events.push({ type, args });
}
for (const type of ["save", "restore", "beginPath", "rect", "clip"]) {
  context.drawingContext[type] = (...args) => events.push({ type: `ctx-${type}`, args });
}
vm.createContext(context);
require("./helpers/runtime-context.cjs").installContext(context);

const run = (code) => vm.runInContext(code, context);
const copy = (value) => JSON.parse(JSON.stringify(value));
run(
  "campaignStartMs = new Date(CONFIG.CAMPAIGN_START_DATE + 'T00:00:00+07:00').getTime(); campaignEndMs = campaignStartMs + CONFIG.CAMPAIGN_DAYS * CONFIG.DAY_MS; preload(); state = createEmptyState(); rebuildDerived();",
);
const render = () => {
  events.length = 0;
  run("drawOverviewGraph(getLayout(), getCampaignTiming(Date.now()), Date.now());");
  return events.filter((event) => event.type === "line");
};
const almostEqual = (actual, expected) =>
  assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const layout = run("getLayout()");
const { x, w, baseline } = layout.overview;
const cursorX = run("overviewXForTimestamp(Date.now(), getLayout())");
almostEqual(cursorX, x + (w * (2 + 3 / 9)) / 7);
assert.equal(run("getCampaignTiming(Date.now()).displayDayIndex"), 2);

// Empty history is flat to the present, with all seven days still on the axis.
assert.deepEqual(
  render().map((event) => event.args),
  [[x, baseline, cursorX, baseline]],
);
assert.deepEqual(
  events.filter((event) => event.type === "text").map((event) => event.args[0]),
  ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
);
const dividers = events.filter((event) => event.source === "assets/overview-day-rule.svg");
assert.equal(dividers.length, 6);
for (const [index, divider] of dividers.entries()) {
  almostEqual(divider.args[0], x + ((index + 1) * w) / 7 - 0.5);
  assert.deepEqual(divider.args.slice(1), [874, 1.00001, 168]);
}
assert.deepEqual(
  events.find((event) => event.source === "assets/overview-baseline.svg").args,
  [1498, 982.5, 389, 1],
);
assert.deepEqual(
  events.find((event) => event.source === "assets/overview-cursor.svg").args,
  [-2.66667, -2.666665, 139.667, 5.33333],
);
assert(
  events.some(
    (event) => event.type === "translate" && event.args[0] === cursorX && event.args[1] === 874,
  ),
);
assert(
  events.findIndex((event) => event.type === "ctx-restore") <
    events.findIndex((event) => event.source === "assets/overview-cursor.svg"),
  "The cursor's top dot must not be clipped",
);
assert(events.some((event) => event.type === "stroke" && event.args[0] === 0));
assert(events.some((event) => event.type === "strokeWeight" && event.args[0] === 2));

// A first vote on Wednesday must not create a diagonal ramp through Monday/Tuesday.
run("state.votes = [[Date.now() - 7200000, YES]]; rebuildDerived();");
const voteX = run("overviewXForTimestamp(Date.now() - 7200000, getLayout())");
const scale = run("overviewVerticalScale(getLayout(), derived.overview)");
const voteY = baseline - 5 * scale;
assert(
  voteY < baseline && baseline - voteY < 5,
  "A single vote must remain miniature, not fill the graph height",
);
const singleVoteTrace = render();
assert.deepEqual(
  singleVoteTrace.map((event) => event.args),
  [
    [x, baseline, voteX, baseline],
    [voteX, baseline, voteX, voteY],
    [voteX, voteY, cursorX, voteY],
  ],
);
assert(
  !events.some((event) => event.type === "circle"),
  "Use the reference's cursor dot rather than a stale endpoint dot",
);

// Same-second choices use the same aggregation order and extrema as the main graph.
run(
  "state.votes = [[Date.now() - 2000, NO], [Date.now() - 2000, YES], [Date.now() - 2000, YES], [Date.now() - 2000, YES]]; rebuildDerived();",
);
assert.deepEqual(copy(run("derived.overview.points.map(point => point.value)")), [15, 10]);
assert.deepEqual(
  copy(run("[derived.overview.minValue, derived.overview.maxValue, derived.overview.finalValue]")),
  [0, 15, 10],
);
assert.equal(run("derived.overview.finalValue"), run("derived.days[2].finalValue"));
assert.equal(run("derived.total"), 4);
const simultaneousTrace = render();
assert.equal(simultaneousTrace.filter((event) => event.args[0] === event.args[2]).length, 2);
almostEqual(
  simultaneousTrace.at(-1).args[3],
  baseline - 10 * run("overviewVerticalScale(getLayout(), derived.overview)"),
);

// Weekly history carries across midnight, while the main graph remains daily.
run(
  "state.votes = [[campaignStartMs + 43200000, YES], [campaignStartMs + CONFIG.DAY_MS + 43200000, NO], [campaignStartMs + 2 * CONFIG.DAY_MS + 36000000, YES]]; rebuildDerived();",
);
assert.deepEqual(copy(run("derived.overview.points.map(point => point.value)")), [5, 0, 5]);
assert.deepEqual(copy(run("derived.days.slice(0, 3).map(day => day.finalValue)")), [5, -5, 5]);
assert.equal(run("derived.overview.finalValue"), 5);

// Dense history retains sharp peaks/troughs, exact totals, ordering, and endpoint.
run(
  "state.votes = Array.from({ length: 4008 }, (_, i) => [campaignStartMs + CONFIG.OPEN_HOUR * 3600000 + i * 1000, i < 1002 || i >= 3006 ? YES : NO]); rebuildDerived();",
);
const dense = copy(run("derived.overview"));
assert.equal(dense.totalSteps, 4008);
assert.equal(dense.finalValue, 0);
assert.equal(dense.maxValue, 5010);
assert.equal(dense.minValue, -5010);
assert(dense.points.length <= 1800);
assert(dense.points.some((point) => point.value === dense.maxValue));
assert(dense.points.some((point) => point.value === dense.minValue));
assert.equal(dense.points[0].index, 0);
assert.equal(dense.points.at(-1).index, 4007);
assert(
  dense.points.every((point, index) => index === 0 || point.index > dense.points[index - 1].index),
);
assert.equal(
  run("state.votes.length"),
  4008,
  "Overview compaction must not mutate or delete recorded votes",
);
const denseScale = run("overviewVerticalScale(getLayout(), derived.overview)");
assert(baseline - dense.maxValue * denseScale > 874);
assert(
  baseline - dense.minValue * denseScale < 1011,
  "Negative history must not collide with the day labels",
);
const denseTrace = render();
assert(denseTrace.length <= 3601);
assert(
  denseTrace.every((event) => event.args[0] === event.args[2] || event.args[1] === event.args[3]),
  "Idle periods must never be interpolated into diagonal changes",
);
assert(
  denseTrace.every((event) => event.args[0] <= cursorX && event.args[2] <= cursorX),
  "Future space must remain blank",
);
assert.equal(denseTrace.at(-1).args[2], cursorX);

// The weekly overview is independent of the blurred completed-day graph:
// retain D1-D7, all dividers and the current-time cursor in every timed state.
now = new Date("2026-09-22T12:00:00+07:00").getTime();
almostEqual(render().at(-1).args[2], x + w);
assert(events.some((event) => event.source === "assets/overview-cursor.svg"));
const weekLabels = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];
assert.deepEqual(
  events.filter((event) => event.type === "text").map((event) => event.args[0]),
  weekLabels,
);
run(
  "state.votes = Array.from({ length: 7 }, (_, i) => [campaignStartMs + i * CONFIG.DAY_MS + 43200000, [YES, NO, YES, YES, NO, NO, YES][i]]); rebuildDerived();",
);
assert.deepEqual(
  copy(run("derived.overview.points.map(point => point.value)")),
  [5, 0, 5, 10, 5, 0, 5],
);
for (const date of [
  "2026-09-14T18:00:00+07:00",
  "2026-09-15T08:17:42+07:00",
  "2026-09-17T02:00:00+07:00",
  "2026-09-17T09:00:00+07:00",
  "2026-09-20T18:00:00+07:00",
  "2026-09-22T12:00:00+07:00",
]) {
  now = new Date(date).getTime();
  const lines = render();
  const endX = run("overviewXForTimestamp(Date.now(), getLayout())");
  almostEqual(lines.at(-1).args[2], endX);
  assert.deepEqual(
    events.filter((event) => event.type === "text").map((event) => event.args[0]),
    weekLabels,
  );
  assert.equal(events.filter((event) => event.source === "assets/overview-day-rule.svg").length, 6);
  assert(events.some((event) => event.source === "assets/overview-cursor.svg"));
  assert(
    lines.every((event) => event.args[0] <= endX && event.args[2] <= endX),
    "future days must stay blank rather than show votes that have not occurred yet",
  );
  const visiblePoints = copy(run("derived.overview.points")).filter(
    (point) => point.timestamp <= now,
  );
  const value = visiblePoints.at(-1)?.value ?? 0;
  almostEqual(
    lines.at(-1).args[3],
    baseline - value * run("overviewVerticalScale(getLayout(), derived.overview)"),
  );
  assert.equal(
    run("derived.total"),
    7,
    "timed screens must never clear or switch the overview's weekly data",
  );
  if (date === "2026-09-17T02:00:00+07:00") {
    assert.equal(run("getCampaignTiming(Date.now()).phase"), "before-day");
    assert.equal(
      run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"),
      2,
      "only the blurred main graph remains on September 16",
    );
    almostEqual(endX, x + (w * 3) / 7);
    assert.equal(
      run("formatCampaignElapsed(Date.now())"),
      "27:00:00",
      "overnight hours must not advance the overview's elapsed voting time",
    );
    assert.equal(
      value,
      5,
      "the September 17 overnight overview must carry the accumulated September 14-16 balance",
    );
  }
}
almostEqual(run("overviewXForTimestamp(campaignStartMs - 1000, getLayout())"), x);
almostEqual(run("overviewXForTimestamp(campaignEndMs + 1000, getLayout())"), x + w);
assert.equal(run("CONFIG.STORAGE_KEY"), "collective_pulse_v4");
assert.equal(run("CONFIG.CAMPAIGN_START_DATE"), "2026-09-14");

// Every equal-width D1-D7 segment is exactly nine open hours. Closed periods
// collapse to the shared 18:00/next 09:00 boundary, including across midnight.
for (let day = 0; day < 7; day++) {
  const at = (hour, extraMs = 0) =>
    run(`campaignStartMs + ${day} * CONFIG.DAY_MS + ${hour} * 3600000 + ${extraMs}`);
  const position = (timestamp) => run(`overviewXForTimestamp(${timestamp}, getLayout())`);
  almostEqual(position(at(0)), x + (day * w) / 7);
  almostEqual(position(at(9)), x + (day * w) / 7);
  almostEqual(position(at(13.5)), x + ((day + 0.5) * w) / 7);
  almostEqual(position(at(18)), x + ((day + 1) * w) / 7);
  almostEqual(position(at(23.999)), x + ((day + 1) * w) / 7);
  almostEqual(position(at(9, -1)), position(at(9)));
  assert(position(at(9, 1)) > position(at(9)));
  assert(position(at(18, -1)) < position(at(18)));
  almostEqual(run(`overviewElapsedMs(${at(18)})`), (day + 1) * 9 * 3600000);
}
assert.equal(run("formatCampaignElapsed(campaignStartMs + 9 * 3600000)"), "00:00:00");
assert.equal(run("formatCampaignElapsed(campaignStartMs + 13.5 * 3600000)"), "04:30:00");
assert.equal(run("formatCampaignElapsed(campaignStartMs + 18 * 3600000)"), "09:00:00");
assert.equal(
  run("formatCampaignElapsed(campaignEndMs - CONFIG.DAY_MS + 18 * 3600000)"),
  "63:00:00",
);
assert.equal(run("formatCampaignElapsed(campaignEndMs + CONFIG.DAY_MS)"), "63:00:00");

// Only the overview filters legacy out-of-hours votes; storage and totals keep
// them intact. 09:00 is included and 18:00 is excluded on each day.
run(
  "state.votes = [[campaignStartMs + 9 * 3600000 - 1, NO], [campaignStartMs + 9 * 3600000, YES], [campaignStartMs + 18 * 3600000 - 1, NO], [campaignStartMs + 18 * 3600000, YES], [campaignStartMs + CONFIG.DAY_MS + 2 * 3600000, YES], [campaignStartMs + CONFIG.DAY_MS + 9 * 3600000, YES]]; rebuildDerived();",
);
assert.equal(run("state.votes.length"), 6);
assert.equal(run("derived.total"), 6);
assert.equal(run("derived.days[0].total"), 4);
assert.equal(run("derived.overview.totalSteps"), 3);
assert.deepEqual(copy(run("derived.overview.points.map(point => point.value)")), [5, 0, 5]);
assert.deepEqual(
  copy(run("[derived.overview.minValue, derived.overview.maxValue, derived.overview.finalValue]")),
  [0, 5, 5],
);

// Dense points across all seven open windows are bucketed on compressed voting
// time too; day-specific peaks and endpoints must survive compaction.
run(
  "state.votes = Array.from({ length: 7 }, (_, day) => Array.from({ length: 600 }, (_, i) => [campaignStartMs + day * CONFIG.DAY_MS + 9 * 3600000 + i * 54000, i < 300 ? YES : NO])).flat(); rebuildDerived();",
);
assert.equal(run("derived.overview.totalSteps"), 4200);
assert(run("derived.overview.points.length <= 1800"));
assert.equal(run("derived.overview.maxValue"), 1500);
assert.equal(run("derived.overview.finalValue"), 0);
for (let day = 0; day < 7; day++) {
  assert(
    run(
      `derived.overview.points.some(point => point.index === ${day * 600 + 299} && point.value === 1500)`,
    ),
    "each open day's peak must survive compressed-time buckets",
  );
}
assert.equal(run("state.votes.length"), 4200);

now = new Date("2026-09-16T12:00:00+07:00").getTime();
for (const [width, height] of [
  [960, 540],
  [1440, 1080],
]) {
  context.width = width;
  context.height = height;
  render();
  const sx = width / 1920,
    sy = height / 1080;
  const cursor = events.find((event) => event.source === "assets/overview-cursor.svg");
  assert.deepEqual(cursor.args, [-2.66667 * sy, -2.666665 * sx, 139.667 * sy, 5.33333 * sx]);
  const divider = events.find((event) => event.source === "assets/overview-day-rule.svg");
  assert.deepEqual(divider.args.slice(1), [874 * sy, 1.00001 * sx, 168 * sy]);
  assert.deepEqual(events.find((event) => event.source === "assets/overview-baseline.svg").args, [
    1498 * sx,
    982.5 * sy,
    389 * sx,
    sy,
  ]);
  assert(events.some((event) => event.type === "ctx-rect" && event.args[3] === 137 * sy));
  for (const event of events)
    for (const number of event.args)
      if (typeof number === "number") assert(Number.isFinite(number));
}
for (const [file, dimensions] of Object.entries({
  "overview-day-rule.svg": [1.00001, 168],
  "overview-baseline.svg": [389, 1],
  "overview-cursor.svg": [139.667, 5.33333],
})) {
  const svg = fs.readFileSync(path.join(project, "public/assets", file), "utf8");
  assert.deepEqual(
    svg
      .match(/width="([\d.]+)" height="([\d.]+)"/)
      .slice(1)
      .map(Number),
    dimensions,
  );
}
console.log(
  "Collective Pulse Figma overview, grouped votes, idle holds, dense extrema, weekly mapping, cursor, and sizing checks passed.",
);

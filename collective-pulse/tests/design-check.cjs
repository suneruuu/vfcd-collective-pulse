const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const project = path.join(__dirname, "..");
const load = require("./helpers/load-module.cjs");
const html = load("tests/helpers/ui-fixture.jsx").installationMarkup({
  now: new Date("2026-09-14T12:00:00+07:00").getTime(),
});
const css = fs.readFileSync(path.join(project, "src/styles/installation.css"), "utf8");
const sketch = fs.readFileSync(
  path.join(project, "src/installation/rendering/renderer.js"),
  "utf8",
);
const nodes = {};
const storage = {};
const events = [];
let fontSize = 0;
let testNow = 0;

for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
  nodes[id] = {
    attributes: {},
    handlers: {},
    clientHeight: 251,
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = value;
      },
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(name, action) {
      this.handlers[name] = action;
    },
    focus() {},
  };
}
const canvas = { elt: { setAttribute() {}, focus() {} }, parent() {} };
const gradient = { addColorStop() {} };
const drawingContext = {
  save() {},
  restore() {},
  beginPath() {},
  rect() {},
  clip() {},
  setLineDash() {},
  createRadialGradient: () => gradient,
  createLinearGradient: () => gradient,
  fillRect: (...args) => events.push({ type: "fillRect", args }),
};
class TestDate extends Date {
  static now() {
    return testNow;
  }
}
const context = {
  console,
  Math,
  Date: TestDate,
  Intl,
  JSON,
  Number,
  Object,
  Array,
  String,
  width: 1920,
  height: 1080,
  windowWidth: 1920,
  windowHeight: 1080,
  window: { devicePixelRatio: 1, addEventListener() {} },
  document: {
    getElementById: (id) => nodes[id],
    querySelector: () => canvas.elt,
    addEventListener() {},
  },
  localStorage: {
    getItem: (key) => storage[key] ?? null,
    setItem: (key, value) => {
      storage[key] = value;
    },
    removeItem: (key) => {
      delete storage[key];
    },
    key: (index) => Object.keys(storage)[index] ?? null,
    get length() {
      return Object.keys(storage).length;
    },
  },
  drawingContext,
  createCanvas: () => canvas,
  resizeCanvas: (w, h) => {
    context.width = w;
    context.height = h;
  },
  loadImage: (source) => {
    assert(
      fs.existsSync(path.join(project, "public", source)),
      `Missing exported asset: ${source}`,
    );
    return { source };
  },
  image: (asset, ...args) => {
    assert(asset?.source, "The drawing must use a loaded exported Figma asset");
    events.push({ type: "image", source: asset.source, args });
  },
  rect: (...args) => events.push({ type: "rect", args }),
  line: (...args) => events.push({ type: "line", args }),
  circle: (...args) => events.push({ type: "circle", args }),
  text: (value, ...args) => events.push({ type: "text", value, args, fontSize }),
  textSize: (size) => {
    fontSize = size;
  },
  textWidth: (value) => value.length * fontSize * 0.5,
  color: (value) => ({ value: value?.value ?? value, setAlpha() {} }),
  lerpColor: (a, b) => b,
  lerp: (a, b, fraction) => a + (b - a) * fraction,
  millis: () => 1000,
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  pow: Math.pow,
  constrain: (value, low, high) => Math.min(high, Math.max(low, value)),
  LEFT: "left",
  RIGHT: "right",
  TOP: "top",
  CENTER: "center",
  BOLD: "bold",
  NORMAL: "normal",
  WORD: "word",
  SQUARE: "square",
  MITER: "miter",
  HALF_PI: Math.PI / 2,
  LEFT_ARROW: 37,
  RIGHT_ARROW: 39,
  mouseX: 0,
  mouseY: 0,
  key: "",
  keyCode: 0,
};
for (const name of [
  "pixelDensity",
  "frameRate",
  "textFont",
  "strokeCap",
  "strokeJoin",
  "noStroke",
  "stroke",
  "strokeWeight",
  "fill",
  "noFill",
  "background",
  "textAlign",
  "textStyle",
  "textLeading",
  "textWrap",
  "push",
  "pop",
  "translate",
  "rotate",
]) {
  context[name] = () => {};
}
vm.createContext(context);
require("./helpers/runtime-context.cjs").installContext(context);

const run = (code) => vm.runInContext(code, context);
testNow = new Date(run("CONFIG.CAMPAIGN_START_DATE") + "T12:00:00+07:00").getTime();
run("preload(); setup(); draw();");
assert.equal(nodes["schedule-weekday"].textContent, "Monday");
assert.equal(nodes["schedule-date"].textContent, "14 September 2026");
assert.equal(nodes["schedule-status"].textContent, "Today");
assert.equal(nodes["festival-schedule"].hidden, false);
assert(nodes["schedule-events"].innerHTML.includes("Street Objects &amp; The New Comfort"));

const layout = run("getLayout()");
assert.equal(layout.graph.x, 53);
assert.equal(layout.graph.y, 285);
assert.equal(layout.graph.w, 1371);
assert.equal(layout.graph.h, 514);
assert.equal(layout.graph.stemBottom, 776);
assert.equal(layout.graph.timestampY, 785);
assert.deepEqual(JSON.parse(JSON.stringify(layout.information)), {
  x: 1465,
  y: 409,
  w: 455,
  h: 671,
});
assert.deepEqual(Array.from(layout.prompt.rows), [872, 914, 951, 988, 1025]);
const heading = events.find((event) => event.value?.includes("annual Creative Festival?"));
assert(heading, "The heading must match the supplied Creative Festival design");
assert.equal(heading.fontSize, 84);
assert.deepEqual(heading.args, [53, 39]);
assert(
  events.some((event) => event.type === "rect" && event.args.join(",") === "1465,409,455,671"),
);
const zeroLabel = events.find((event) => event.type === "text" && event.value === "0");
assert(zeroLabel, "The voting-balance y-axis must label zero");
assert.deepEqual(
  zeroLabel.args,
  [43, 542],
  "The zero label must start halfway along the y-axis, matching program 2",
);
assert.equal(zeroLabel.fontSize, 12);
assert(
  events.some((event) => event.type === "line" && event.args.join(",") === "47,542,53,542"),
  "The zero tick must intersect the y-axis at its midpoint",
);
assert(
  events.some((event) => event.type === "line" && event.args.join(",") === "53,542,1424,542"),
  "The zero reference must span the graph at its midpoint",
);
assert(
  events.some((event) => event.type === "circle" && event.args[1] === 542),
  "A fresh empty session's live point must start at the centered zero",
);

for (const choice of [1, -1]) {
  run(
    `state.votes = [[Date.now() - 2000, ${choice}]]; rebuildDerived(); fitAll = false; followLive = false; viewStartSecond = 43197;`,
  );
  events.length = 0;
  run("drawDailyGraph(getLayout(), getCampaignTiming(Date.now()), Date.now());");
  const bars = events.filter((event) => event.type === "rect");
  const vote = bars[bars.length - 2];
  const pending = bars[bars.length - 1];
  assert.equal(vote.args[3], 17, "The base YES/NO vote must render at 17px");
  assert.equal(pending.args[3], 17, "The pending band must keep the 17px base height");
  assert.equal(pending.args[1], vote.args[1], "The pending band must remain aligned with the vote");
}
run("state.votes = []; rebuildDerived(); followLive = true;");

run(
  "resetInputSampling(Date.now() - 1000); queueDirection(NO, Date.now() - 900); queueDirection(YES, Date.now() - 800); queueDirection(YES, Date.now() - 700); queueDirection(YES, Date.now() - 600); updateInputSampling();",
);
assert.equal(run("derived.yes"), 3);
assert.equal(run("derived.no"), 1);
run("fitAll = false; followLive = false; viewStartSecond = 43199;");
events.length = 0;
run("drawDailyGraph(getLayout(), getCampaignTiming(Date.now() + 2000), Date.now() + 2000);");
const batchRects = events.filter((event) => event.type === "rect");
const batchYes = batchRects[batchRects.length - 3];
const batchNo = batchRects[batchRects.length - 2];
const batchPending = batchRects[batchRects.length - 1];
assert.equal(
  batchYes.args[2],
  batchNo.args[2],
  "Concurrent YES/NO bars must have equal widths regardless of counts",
);
assert.equal(batchYes.args[3], 51, "Three concurrent YES presses must use three 17px base steps");
assert.equal(batchNo.args[3], 17, "One concurrent NO press must use one 17px base step");
assert.equal(batchPending.args[1], batchNo.args[1]);
assert.equal(
  batchPending.args[3],
  batchNo.args[3],
  "Pending must match the last aggregate bar, not the whole batch",
);
run("state.votes = []; rebuildDerived(); resetInputSampling(); followLive = true;");

run(
  "state.prompts.visible = [[0, Date.now()], [1, Date.now()], [2, Date.now()], [3, Date.now()], [4, Date.now()]];",
);
events.length = 0;
run("drawPrompts(getLayout());");
const rules = events.filter((event) => event.type === "image");
assert.equal(rules.length, 5);
assert.deepEqual(
  rules.map((event) => event.source),
  [
    "assets/prompt-40.svg",
    "assets/prompt-40.svg",
    "assets/prompt-50.svg",
    "assets/prompt-60.svg",
    "assets/prompt-100.svg",
  ],
);
for (const rule of rules) {
  assert.equal(rule.args[0], 138);
  assert.equal(rule.args[2], 60);
  assert.equal(rule.args[3], 2);
}

// Check exported leaf dimensions separately from their parent control boxes.
const assetSizes = {
  "live.svg": [20, 20],
  "fit.svg": [20, 20],
  "scroll.svg": [24, 24],
  "panel-toggle.svg": [21, 33],
  "waiting-panel-toggle.svg": [21, 33],
  "view-pulse.svg": [24, 24],
  "zoom-plus-horizontal.svg": [16, 2],
  "zoom-minus.svg": [17, 2],
  "axis.svg": [514.5, 7.36396],
  "live-cursor.svg": [494.333, 10.6667],
  "overview-cursor.svg": [139.667, 5.33333],
  "panel-rule.svg": [389, 1],
  "overview-day-rule.svg": [1.00001, 168],
  "overview-baseline.svg": [389, 1],
  "prompt-40.svg": [60, 2],
  "prompt-50.svg": [60, 2],
  "prompt-60.svg": [60, 2],
  "prompt-100.svg": [60, 2],
  "schedule-column-rule.svg": [251, 2],
  "schedule-now.svg": [383.333, 10.6667],
};
for (const [file, expected] of Object.entries(assetSizes)) {
  const svg = fs.readFileSync(path.join(project, "public/assets", file), "utf8");
  const dimensions = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
  assert(dimensions, `Missing fixed leaf dimensions for ${file}`);
  assert.deepEqual(
    dimensions.slice(1).map(Number),
    expected,
    `Exported geometry changed for ${file}`,
  );
}
for (const [, source] of html.matchAll(/src="(assets\/[^"]+)"/g)) {
  assert(fs.existsSync(path.join(project, source)), `Broken control asset: ${source}`);
}
assert(css.includes("transform: rotate(90deg)"), "The vertical plus leaf must rotate, not stretch");
assert(
  css.includes("width: calc(20 * var(--ui))") && css.includes("height: calc(20 * var(--ui))"),
  "Mode icons must keep their fixed square aspect ratio",
);
const controls = run("viewControlRects(getLayout())");
assert.equal(controls.zoomIn.x, 1205);
assert.equal(controls.zoomOut.x, 1237);
assert.equal(controls.live.x, 1281);
assert.equal(controls.fitAll.x, 1358);
for (const box of Object.values(controls)) {
  assert.equal(box.y, 26);
  assert.equal(box.h, 33);
}

nodes["view-fit"].handlers.click();
assert.equal(run("fitAll"), true);
nodes["view-live"].handlers.click();
assert.equal(run("fitAll"), false);
assert.equal(run("followLive"), true);
const previousZoom = run("zoomSecondWidth");
nodes["view-zoom-in"].handlers.click();
assert.equal(run("zoomSecondWidth"), previousZoom * run("CONFIG.ZOOM_FACTOR"));
nodes["view-zoom-out"].handlers.click();
assert.equal(run("zoomSecondWidth"), previousZoom);
context.mouseX = 300;
context.mouseY = 400;
assert.equal(run("mouseWheel({ deltaY: -100 })"), false);
assert.equal(run("zoomSecondWidth"), previousZoom * run("CONFIG.ZOOM_FACTOR"));
nodes["panel-toggle"].handlers.click();
assert.equal(run("getLayout().graph.w"), 1826);
run("draw();");
assert.equal(nodes["festival-schedule"].hidden, true);
nodes["panel-toggle"].handlers.click();
assert.equal(run("getLayout().graph.w"), 1371);
run("draw();");
assert.equal(nodes["festival-schedule"].hidden, false);

context.width = 960;
context.height = 540;
const smaller = run("getLayout()");
assert.equal(smaller.information.x, 732.5);
assert.equal(smaller.graph.w, 685.5);
assert.equal(smaller.ui, 0.5);
events.length = 0;
run("draw();");
const smallerZeroLabel = events.find((event) => event.type === "text" && event.value === "0");
assert.deepEqual(
  smallerZeroLabel.args,
  [21.5, 271],
  "The zero marker must remain at the y-axis midpoint when the canvas resizes",
);
assert.equal(smallerZeroLabel.fontSize, 6);
for (const event of events) {
  for (const value of event.args) {
    if (typeof value === "number") assert(Number.isFinite(value), `Invalid ${event.type} geometry`);
  }
}
testNow = new Date("2026-09-16T12:00:00+07:00").getTime();
run("draw();");
assert.equal(nodes["schedule-weekday"].textContent, "Wednesday");
assert.equal(nodes["schedule-date"].textContent, "16 September 2026");
assert.equal(nodes["schedule-status"].textContent, "Today");
assert(nodes["schedule-events"].innerHTML.includes("VNx Panel | Learning Beyond Classroom"));
assert.equal(run("getCampaignTiming(Date.now()).displayDayIndex"), 2);

// Explicit CSS geometry for all three timed Figma screens, not browser QA.
function cssNumber(selector, property, w, h, mainWidth = (1465 * w) / 1920) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]+)\\}`))?.[1];
  assert(block, `Missing selector ${selector}`);
  let value = block.match(new RegExp(`(?:^|\\n)\\s*${property}: ([^;]+);`))?.[1];
  assert(value, `Missing ${property} in ${selector}`);
  const scales = {
    sx: w / 1920,
    sy: h / 1080,
    ui: Math.min(w / 1920, h / 1080),
    "main-width": mainWidth,
  };
  value = value
    .replace(/^calc\((.*)\)$/, "$1")
    .replace(/var\(--([\w-]+)\)/g, (_, name) => scales[name])
    .replace(/([\d.]+)px/g, "$1");
  assert(/^[\d.\s*+\-/()]+$/.test(value), `Unexpected dimension ${value}`);
  return Function(`return (${value})`)();
}
const firstLabel = '#campaign-screen[data-phase="before-event"] #campaign-screen-label';
const firstValue = '#campaign-screen[data-phase="before-event"] #campaign-screen-value';
assert(
  !sketch.includes("drawCampaignOverlay") && !sketch.includes('"VOTING CLOSED"'),
  "the obsolete boxed closed overlay must be removed, not layered behind the Figma screens",
);
assert(
  html.indexOf('id="campaign-screen"') < html.indexOf('id="festival-schedule"'),
  "the blur must be below the unblurred sidebar in paint order",
);
assert(
  css.includes("backdrop-filter: blur(calc(15 * var(--ui)))"),
  "use the design's 15px backdrop blur, not blur on the countdown or whole page",
);

for (const [w, h] of [
  [1920, 1080],
  [960, 540],
  [1440, 1080],
]) {
  context.width = w;
  context.height = h;
  testNow = new Date("2026-09-14T08:17:42+07:00").getTime();
  run("state.votes = []; rebuildDerived();");
  events.length = 0;
  run("draw();");
  const sx = w / 1920,
    sy = h / 1080,
    ui = Math.min(sx, sy);
  assert.equal(run("panelColor.value"), "#F3F3F3", "only the first opening must use neutral white");
  assert.equal(nodes["campaign-screen"].attributes["data-phase"], "before-event");
  assert.equal(nodes["campaign-screen"].hidden, false);
  assert.equal(nodes["view-controls"].attributes["data-waiting"], "true");
  assert.equal(
    nodes["festival-schedule"].hidden,
    false,
    "the agenda and panel toggle must remain available before opening",
  );
  assert.equal(nodes["schedule-weekday"].textContent, "Monday");
  const waitingPanel = events.find((event) => event.type === "rect");
  assert.deepEqual(waitingPanel.args, [1465 * sx, 409 * sy, 455 * sx, 672 * sy]);
  assert.equal(nodes["campaign-screen-label"].textContent, "COLLECTIVE PULSE STARTS IN");
  assert.equal(nodes["campaign-screen-value"].textContent, "00 : 42 : 18");
  assert.equal(nodes["view-pulse"].hidden, true, "the first opening must not show View pulse");
  assert.equal(cssNumber(firstLabel, "top", w, h), 914 * sy);
  assert.equal(cssNumber(firstValue, "top", w, h), 948 * sy);
  assert.equal(cssNumber("#campaign-screen-label", "font-size", w, h), 24 * ui);
  assert.equal(cssNumber("#campaign-screen-value", "font-size", w, h), 84 * ui);
  assert.equal(cssNumber("#campaign-screen p", "width", w, h) / 2, 732 * sx);
  assert.equal(cssNumber("#campaign-screen", "width", w, h), 1465 * sx);
  assert.equal(cssNumber("#campaign-screen", "height", w, h), 1081 * sy);
  assert.equal(nodes["campaign-screen"].style.values["--main-width"], `${1465 * sx}px`);
  assert(
    !events.some((event) => event.value?.includes("annual Creative Festival?")),
    "the waiting main area must not show the voting heading",
  );
  assert(
    !events.some(
      (event) =>
        event.value === "OVERVIEW" || event.value?.includes("RESPONSES") || event.value === "0",
    ),
    "statistics and voting axes must be absent only before the first opening",
  );
  const waitingImages = events.filter((event) => event.type === "image");
  assert.equal(waitingImages.length, 1);
  assert.equal(waitingImages[0].source, "assets/panel-rule.svg");
  assert.deepEqual(waitingImages[0].args, [1498 * sx, 667 * sy, 389 * sx, sy]);
  assert.equal(
    run("queueDirection(YES, Date.now())"),
    false,
    "waiting-screen arrows must not vote",
  );
  assert.equal(run("derived.total"), 0);

  // Later mornings: yesterday's real vote trace and leader-colored results
  // remain behind a left-only blur, while today's agenda stays unblurred.
  testNow = new Date("2026-09-16T08:17:42+07:00").getTime();
  run("state.votes = [[campaignStartMs + CONFIG.DAY_MS + 43200000, NO]]; rebuildDerived();");
  events.length = 0;
  run("draw();");
  assert.equal(nodes["campaign-screen"].attributes["data-phase"], "before-day");
  assert.equal(nodes["campaign-screen-label"].textContent, "TODAY PULSE STARTS IN");
  assert.equal(nodes["campaign-screen-value"].textContent, "00 : 42 : 18");
  assert.equal(nodes["view-pulse"].hidden, false);
  assert.equal(
    run("panelColor.value"),
    "#FF6D05",
    "later openings must retain the vote leader, not reset the sidebar to white",
  );
  assert.equal(nodes["schedule-weekday"].textContent, "Wednesday");
  assert.equal(
    run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"),
    1,
    "Wednesday morning must show Tuesday's completed graph",
  );
  assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).liveSecond"), 64800);
  assert.equal(run("derived.days[2].total"), 0);
  assert(events.some((event) => event.value?.includes("annual Creative Festival?")));
  assert(events.some((event) => event.value === "OVERVIEW"));
  assert(events.some((event) => event.value === "1 RESPONSES"));
  assert.deepEqual(
    events.filter((event) => /^D[1-7]$/.test(event.value)).map((event) => event.value),
    ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
    "later mornings must show the whole seven-day overview, not a single-day label",
  );
  assert(
    events.some((event) => event.type === "rect" && event.args[3] === 17 * ui),
    "the earlier day's actual vote must remain drawn behind the blur",
  );
  assert(events.some((event) => event.source === "assets/overview-cursor.svg"));
  assert.equal(
    events.filter((event) => event.source === "assets/overview-day-rule.svg").length,
    6,
    "all seven days must remain separated while voting is closed",
  );
  assert.equal(cssNumber("#campaign-screen-label", "top", w, h), 859 * sy);
  assert.equal(cssNumber("#campaign-screen-value", "top", w, h), 893 * sy);
  assert.equal(cssNumber("#view-pulse", "left", w, h), 663 * sx);
  assert.equal(cssNumber("#view-pulse", "top", w, h), 1008 * sy);
  assert.equal(cssNumber("#view-pulse", "width", w, h), 139 * sx);
  assert.equal(cssNumber("#view-pulse", "height", w, h), 33 * sy);
  assert.equal(cssNumber("#view-pulse img", "left", w, h) + 1, 14 * sx);
  assert.equal(cssNumber("#view-pulse img", "top", w, h) + 1, 4 * sy);
  assert.equal(cssNumber("#view-pulse img", "width", w, h), 24 * sx);
  assert.equal(cssNumber("#view-pulse img", "height", w, h), 24 * sy);
  assert.equal(cssNumber("#view-pulse-label", "width", w, h), 79 * sx);
  assert.equal(cssNumber("#view-pulse-label", "height", w, h), 18 * sy);
  assert.equal(cssNumber("#panel-toggle img", "width", w, h), 21 * sx);
  assert.equal(cssNumber("#panel-toggle img", "height", w, h), 33 * sy);
  assert.equal(run("recordVotes([YES, NO], Date.now())"), false);
  assert.equal(run("derived.total"), 1);
}
assert(
  css.includes('#view-controls[data-waiting="true"] .zoom-button') &&
    css.includes('#view-controls[data-waiting="true"] .scroll-hint'),
  "the waiting design must hide only graph navigation and retain the sidebar toggle",
);
assert(css.includes('[data-phase="before-event"] #panel-toggle .waiting-toggle'));
assert(
  css.includes("#panel-toggle .daily-toggle"),
  "later timed states must use their exact exported sidebar asset",
);

context.width = 1920;
context.height = 1080;
testNow = new Date("2026-09-13T08:17:42+07:00").getTime();
run("draw();");
assert.equal(nodes["campaign-screen"].attributes["data-phase"], "before-event");
assert.equal(nodes["campaign-screen-value"].textContent, "24 : 42 : 18");

testNow = new Date("2026-09-16T09:00:00+07:00").getTime();
events.length = 0;
run("draw();");
assert.equal(nodes["view-controls"].attributes["data-waiting"], "false");
assert.equal(
  nodes["campaign-screen"].hidden,
  true,
  "the Figma timed overlay must be fully hidden at opening",
);
assert(
  events.some((event) => event.value?.includes("annual Creative Festival?")),
  "the original voting GUI must return at exactly 09:00",
);
assert(events.some((event) => event.value === "OVERVIEW" && event.fontSize === 20));
run(
  "fitAll = false; followLive = true; zoomSecondWidth = CONFIG.SECOND_WIDTH; state.votes.push([Date.now(), YES], [Date.now() + 1000, YES]); rebuildDerived();",
);
testNow = new Date("2026-09-16T18:00:00+07:00").getTime();
events.length = 0;
run("draw();");
assert.equal(nodes["campaign-screen"].hidden, false);
assert.equal(nodes["campaign-screen"].attributes["data-phase"], "after-day");
assert.equal(nodes["campaign-screen-label"].textContent, "THANK YOU FOR PARTICIPATING");
assert.equal(nodes["campaign-screen-value"].textContent, "NEXT PULSE TOMORROW · 09:00");
assert.equal(nodes["view-pulse"].hidden, false);
assert.equal(run("panelColor.value"), "#06FFCD");
assert.deepEqual(
  events.filter((event) => /^D[1-7]$/.test(event.value)).map((event) => event.value),
  ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
);
assert.equal(run("fitAll"), true, "the completed day's full pulse must fit behind the blur");
assert.equal(
  run("viewStartSecond"),
  32400,
  "the completed graph must start at opening rather than include nine empty pre-opening hours",
);
assert.equal(run("recordVote(YES, Date.now())"), false);
assert.equal(run("derived.total"), 3);

nodes["view-pulse"].handlers.click();
run("draw();");
assert.equal(nodes["campaign-screen"].attributes["data-preview"], "true");
assert.equal(nodes["view-controls"].attributes["data-waiting"], "false");
assert.equal(nodes["view-pulse-label"].textContent, "Hide pulse");
assert.equal(run("recordVote(YES, Date.now())"), false, "View pulse must never reopen voting");
assert(css.includes('#campaign-screen[data-preview="true"] .campaign-screen-copy'));
assert(css.includes("backdrop-filter: none;"));
context.mouseX = 300;
context.mouseY = 400;
assert.equal(
  run("mouseWheel({ deltaY: -100 })"),
  false,
  "the completed pulse must be browsable in View pulse",
);
nodes["view-pulse"].handlers.click();
run("draw();");
assert.equal(nodes["campaign-screen"].attributes["data-preview"], "false");
assert.equal(nodes["view-pulse-label"].textContent, "View pulse");
assert.equal(
  run("mouseWheel({ deltaY: -100 })"),
  true,
  "hidden graph navigation must not respond under the blur",
);

nodes["panel-toggle"].handlers.click();
run("draw();");
assert.equal(nodes["festival-schedule"].hidden, true);
assert.equal(nodes["campaign-screen"].style.values["--main-width"], "1920px");
assert.equal(cssNumber("#campaign-screen", "width", 1920, 1080, 1920), 1920);
nodes["panel-toggle"].handlers.click();
run("draw();");
assert.equal(nodes["festival-schedule"].hidden, false);

testNow = new Date("2026-09-17T02:00:00+07:00").getTime();
events.length = 0;
run("draw();");
assert.equal(
  nodes["campaign-screen-value"].textContent,
  "07 : 00 : 00",
  "the opening countdown still uses real clock time",
);
assert(
  events.some((event) => event.value === "27:00:00"),
  "the sidebar timer must count only three completed nine-hour voting windows",
);
assert.equal(
  run("overviewXForTimestamp(Date.now(), getLayout())"),
  1498 + (389 * 3) / 7,
  "the overview must pause at the D3/D4 boundary overnight",
);
testNow = new Date("2026-09-17T08:17:42+07:00").getTime();
events.length = 0;
run("draw();");
assert.equal(nodes["campaign-screen-label"].textContent, "TODAY PULSE STARTS IN");
assert.equal(nodes["campaign-screen-value"].textContent, "00 : 42 : 18");
assert.equal(nodes["schedule-weekday"].textContent, "Thursday");
assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"), 2);
assert.deepEqual(
  events.filter((event) => /^D[1-7]$/.test(event.value)).map((event) => event.value),
  ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
);
testNow = new Date("2026-09-17T09:00:00+07:00").getTime();
run("draw();");
assert.equal(nodes["campaign-screen"].hidden, true);
assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"), 3);
assert.equal(run("fitAll"), false, "reopening must restore the open-hours camera mode");
assert.equal(run("followLive"), true);
assert.equal(
  run("zoomSecondWidth"),
  28,
  "closed-state browsing must not change the open-hours zoom",
);

testNow = new Date("2026-09-20T18:00:00+07:00").getTime();
events.length = 0;
run("draw();");
assert.equal(nodes["campaign-screen-label"].textContent, "THANK YOU FOR PARTICIPATING");
assert.equal(
  nodes["campaign-screen-value"].textContent,
  "COLLECTIVE PULSE COMPLETE",
  "the final day must not promise another opening outside the configured week",
);
assert.equal(run("getCampaignTiming(Date.now()).nextOpenMs"), null);

// Each overview segment loads only its own saved daily pulse. Transparent native
// buttons keep the existing canvas design while providing touch/keyboard access.
testNow = new Date("2026-09-22T12:00:00+07:00").getTime();
run(`
  state.votes = Array.from({ length: CONFIG.CAMPAIGN_DAYS }, (_, day) =>
    Array.from({ length: day + 1 }, () => [campaignStartMs + day * CONFIG.DAY_MS + 43200000, YES])
  ).flat();
  rebuildDerived(); resetInputSampling(); draw();
`);
const sevenDayVotes = run("JSON.stringify(state.votes)");
const savedBeforeReview = JSON.stringify(storage);
assert.equal(run("derived.total"), 28);
assert(css.includes("#overview-days button:focus-visible"));
assert(css.includes("grid-template-columns: repeat(7, minmax(0, 1fr))"));
for (const [w, h] of [
  [1920, 1080],
  [960, 540],
  [1280, 1080],
]) {
  context.width = w;
  context.height = h;
  const sx = w / 1920,
    sy = h / 1080,
    ui = Math.min(sx, sy);
  const overview = run("getLayout().overview");
  assert.equal(cssNumber("#overview-days", "left", w, h), overview.x);
  assert.equal(cssNumber("#overview-days", "top", w, h), 874 * sy);
  assert.equal(cssNumber("#overview-days", "width", w, h), overview.w);
  assert.equal(cssNumber("#overview-days", "height", w, h), 168 * sy);
  for (let day = 0; day < 7; day++) {
    const x = overview.x + ((day + 0.5) * overview.w) / 7;
    assert.equal(run(`overviewDayAtPoint(getLayout(), ${x}, ${900 * sy})`), day);
    assert.equal(
      run(`overviewDayAtPoint(getLayout(), ${x}, ${1030 * sy})`),
      day,
      "day labels must also be clickable",
    );
    assert.equal(
      run(`overviewDayAtPoint(getLayout(), ${overview.x + (day * overview.w) / 7}, ${900 * sy})`),
      day,
      "exact dividers must select the segment to their right",
    );
    assert(html.includes(`id="overview-day-${day}"`));
    nodes[`overview-day-${day}`].handlers.click();
    events.length = 0;
    run("draw();");
    assert.equal(run("selectedOverviewDay"), day);
    assert.equal(run("viewedDayIndex"), day);
    assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"), day);
    assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).active"), false);
    assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).liveSecond"), 64800);
    assert.equal(run("viewStartSecond"), 32400);
    assert.equal(run("fitAll"), true);
    assert.equal(run("followLive"), false);
    assert.equal(
      run("timelineSecondWidth"),
      (1371 * sx) / 32400,
      "the completed daily graph must fit 09:00–18:00",
    );
    assert.equal(nodes["overview-days"].hidden, false);
    assert.equal(nodes["view-live"].attributes["aria-pressed"], "false");
    assert.equal(
      nodes["campaign-screen"].attributes["data-preview"],
      "true",
      "selecting a closed day's graph must remove the blur",
    );
    for (let other = 0; other < 7; other++) {
      assert.equal(
        nodes[`overview-day-${other}`].attributes["aria-pressed"],
        String(other === day),
      );
    }
    assert.equal(
      nodes[`overview-day-${day}`].attributes["aria-label"],
      `View D${day + 1}, ${String(14 + day).padStart(2, "0")}/09/2026 graph`,
    );
    const dailyBars = events
      .filter((event) => event.type === "rect" && event.args[0] < 1465 * sx)
      .slice(1);
    assert(dailyBars.length > 0);
    assert(
      dailyBars.every((event) => Math.abs(event.args[3] - 17 * ui * (day + 1)) < 1e-8),
      "the main graph must not include another day's bars",
    );
    assert(
      !events.some((event) => event.source === "assets/live-cursor.svg"),
      "historical graphs must not pretend to be live",
    );
    assert(events.some((event) => event.source === "assets/overview-cursor.svg"));
    assert.equal(events.filter((event) => /^D[1-7]$/.test(event.value)).length, 7);
    const selectedX = overview.x + (day * overview.w) / 7;
    assert(
      events.some(
        (event) =>
          event.type === "line" &&
          event.args[0] === selectedX &&
          event.args[1] === 1047 * sy &&
          event.args[2] === selectedX + 24 * ui &&
          event.args[3] === 1047 * sy,
      ),
      "only the selected day needs an understated underline",
    );
    assert.equal(
      run("JSON.stringify(state.votes)"),
      sevenDayVotes,
      "browsing must never rewrite saved votes",
    );
  }
  assert.equal(run(`overviewDayAtPoint(getLayout(), ${overview.x + overview.w}, ${900 * sy})`), 6);
  assert.equal(run(`overviewDayAtPoint(getLayout(), ${overview.x - 1}, ${900 * sy})`), null);
  assert.equal(run(`overviewDayAtPoint(getLayout(), ${overview.x}, ${873 * sy})`), null);
  context.mouseX = overview.x + (2.5 * overview.w) / 7;
  context.mouseY = 900 * sy;
  assert.equal(run("mousePressed()"), false);
  run("draw();");
  assert.equal(
    run("selectedOverviewDay"),
    2,
    "canvas clicks and native buttons must select the same day",
  );
}
assert.equal(
  JSON.stringify(storage),
  savedBeforeReview,
  "review selection must not create, clear or overwrite browser storage",
);
for (const invalid of [-1, 7, 1.5, "NaN"]) {
  assert.equal(run(`selectOverviewDay(${invalid})`), false);
  assert.equal(run("selectedOverviewDay"), 2);
}
nodes["panel-toggle"].handlers.click();
run("draw();");
assert.equal(nodes["overview-days"].hidden, true);
assert.equal(run("overviewDayAtPoint(getLayout(), 1500, 900)"), null);
assert.equal(run("selectOverviewDay(0)"), false);
nodes["panel-toggle"].handlers.click();
run("draw();");
assert.equal(nodes["overview-days"].hidden, false);

// Reading Monday/Tuesday during Wednesday's opening hours cannot redirect
// responses or the schedule, and a fresh future day must show an empty graph.
context.width = 1920;
context.height = 1080;
testNow = new Date("2026-09-16T12:00:00+07:00").getTime();
run(`
  state.votes = [
    [campaignStartMs + 43200000, YES], [campaignStartMs + 43200000, YES],
    [campaignStartMs + CONFIG.DAY_MS + 43200000, NO],
    [campaignStartMs + CONFIG.DAY_MS + 43200000, NO],
    [campaignStartMs + CONFIG.DAY_MS + 43200000, NO],
    [Date.now() - 1000, YES]
  ];
  rebuildDerived(); resetInputSampling(); draw();
`);
assert.equal(
  run("selectedOverviewDay"),
  null,
  "opening/closing transitions must restore the normal timed view",
);
for (const day of [0, 1]) {
  nodes[`overview-day-${day}`].handlers.click();
  events.length = 0;
  run("draw();");
  const dailyBars = events
    .filter((event) => event.type === "rect" && event.args[0] < 1465)
    .slice(1);
  assert(dailyBars.every((event) => event.args[3] === (day === 0 ? 34 : 51)));
  assert.equal(run("getCampaignTiming(Date.now()).activeDayIndex"), 2);
  assert.equal(nodes["schedule-weekday"].textContent, "Wednesday");
  assert.equal(nodes["schedule-date"].textContent, "16 September 2026");
}
const historicalVotes = run("JSON.stringify(state.votes.slice(0, 5))");
run("fitAll = false; followLive = false; viewStartSecond = 43199;");
assert.equal(run("recordVotes([YES, NO], Date.now())"), true);
run("draw();");
assert.equal(run("selectedOverviewDay"), 1);
assert.equal(run("followLive"), false, "new votes must not jump the historical camera");
assert.equal(run("viewStartSecond"), 43199);
assert.equal(run("JSON.stringify(state.votes.slice(0, 5))"), historicalVotes);
assert.equal(run("derived.days[0].total"), 2);
assert.equal(run("derived.days[1].total"), 3);
assert.equal(run("derived.days[2].total"), 3, "votes still belong to the actual current day");
nodes["overview-day-6"].handlers.click();
events.length = 0;
run("draw();");
assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"), 6);
assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).liveSecond"), 32400);
assert.equal(run("derived.days[6].total"), 0);
assert(
  !events.some((event) => event.type === "rect" && event.args[0] < 1465),
  "a future empty day cannot show current or historical votes",
);
nodes["view-live"].handlers.click();
run("draw();");
assert.equal(run("selectedOverviewDay"), null);
assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"), 2);
assert.equal(run("fitAll"), false);
assert.equal(run("followLive"), true);
assert.equal(nodes["view-live"].attributes["aria-pressed"], "true");
assert(
  Array.from(
    { length: 7 },
    (_, day) => nodes[`overview-day-${day}`].attributes["aria-pressed"],
  ).every((value) => value === "false"),
);

testNow = new Date("2026-09-17T02:00:00+07:00").getTime();
run("draw();");
nodes["overview-day-0"].handlers.click();
run("draw();");
assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"), 0);
assert.equal(nodes["campaign-screen"].attributes["data-preview"], "true");
assert.equal(
  run("recordVote(YES, Date.now())"),
  false,
  "historical review must not reopen closed voting",
);
assert.equal(run("overviewXForTimestamp(Date.now(), getLayout())"), 1498 + (389 * 3) / 7);
nodes["view-pulse"].handlers.click();
run("draw();");
assert.equal(run("selectedOverviewDay"), null);
assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"), 2);
assert.equal(nodes["campaign-screen"].attributes["data-preview"], "false");
nodes["overview-day-1"].handlers.click();
testNow = new Date("2026-09-17T09:00:00+07:00").getTime();
run("draw();");
assert.equal(run("selectedOverviewDay"), null);
assert.equal(run("getGraphTiming(getCampaignTiming(Date.now())).displayDayIndex"), 3);
assert.equal(nodes["campaign-screen"].hidden, true);

testNow = new Date("2026-09-14T08:00:00+07:00").getTime();
run("draw();");
assert.equal(nodes["overview-days"].hidden, true);
assert.equal(run("selectOverviewDay(0)"), false);
assert.equal(run("overviewDayAtPoint(getLayout(), 1500, 900)"), null);
console.log(
  "Collective Pulse Figma layout, exported assets, drawing, controls, and seven-day graph selection checks passed.",
);

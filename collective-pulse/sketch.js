// COLLECTIVE PULSE
// Seven-day, single-kiosk voting installation.
//
// INPUT CONTRACT (also compatible with a Makey Makey):
//   LEFT ARROW  -> YES -> graph moves up
//   RIGHT ARROW -> NO  -> graph moves down

const CONFIG = Object.freeze({
  // Edit this one value before the installation begins.
  CAMPAIGN_START_DATE: "2026-08-26",
  CAMPAIGN_TIMEZONE_OFFSET: "+07:00",
  CAMPAIGN_DAYS: 7,
  SEED_DEMO_DATA: true,

  YES_COLOR: "#06FFCD",
  NO_COLOR: "#FF6D05",

  // Used before the first vote. During later ties, the last leader is retained.
  TIE_PANEL_COLOR: "#06FFCD",

  PROMPT_INTERVAL_MS: 5 * 60 * 1000,
  MAX_VISIBLE_PROMPTS: 4,
  VOTE_RIPPLE_MS: 2400,
  VOTE_RIPPLE_MAX_RADIUS: 588,

  DAY_MS: 24 * 60 * 60 * 1000,
  DAY_SECONDS: 24 * 60 * 60,
  SECOND_WIDTH: 28,
  MAX_SECOND_WIDTH: 224,
  ZOOM_FACTOR: 1.5,
  STORAGE_KEY: "collective_pulse_v2",
  STORAGE_NAMESPACE: "collective_pulse_"
});

// Add, remove, or reorder questions here. The list loops continuously.
const PROMPTS = Object.freeze([
  "How can design contribute to Vietnam's future?",
  "What should a design festival represent?",
  "Who should a design festival be for?",
  "Would you help shape the next festival?",
  "Whose voices are missing from Vietnam's design conversations?",
  "What should an annual design festival make possible?",
  "How can design change the place you live?",
  "Which local issue deserves more creative attention?",
  "What would make the festival feel truly public?",
  "How can design protect culture while creating change?",
  "What everyday system would you redesign first?",
  "How could a festival continue after the event ends?"
]);

const STATE_VERSION = 2;
const YES = 1;
const NO = -1;

let campaignStartMs = 0;
let campaignEndMs = 0;
let state;
let derived;
let panelColor;
let targetPanelColor;
let storageFailed = false;

let followLive = true;
let fitAll = false;
let viewStartSecond = 0;
let viewedDayIndex = 0;
let dragState = null;
let timelineSecondWidth = CONFIG.SECOND_WIDTH;
let zoomSecondWidth = CONFIG.SECOND_WIDTH;

let ripples = [];
let lastPromptAddedAt = 0;
let lastFrameDayIndex = null;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("app");
  canvas.elt.setAttribute("tabindex", "0");
  canvas.elt.setAttribute(
    "aria-label",
    "Collective Pulse. Press left arrow for yes or right arrow for no."
  );

  pixelDensity(min(window.devicePixelRatio || 1, 2));
  frameRate(60);
  textFont("Iosevka Charon");
  strokeCap(SQUARE);
  strokeJoin(MITER);

  campaignStartMs = new Date(
    `${CONFIG.CAMPAIGN_START_DATE}T00:00:00${CONFIG.CAMPAIGN_TIMEZONE_OFFSET}`
  ).getTime();
  campaignEndMs = campaignStartMs + CONFIG.CAMPAIGN_DAYS * CONFIG.DAY_MS;

  clearLegacyCampaignStorage();
  state = loadState();
  rebuildDerived();

  targetPanelColor = color(panelColorForTotals());
  panelColor = color(targetPanelColor);

  const timing = getCampaignTiming(Date.now());
  viewedDayIndex = timing.displayDayIndex;
  lastFrameDayIndex = timing.activeDayIndex;
  ensurePromptDay(timing, Date.now());

  window.addEventListener("beforeunload", saveState);
  canvas.elt.focus();
}

function draw() {
  const now = Date.now();
  const timing = getCampaignTiming(now);
  const layout = getLayout();

  handleDayChange(timing, now);
  updatePromptClock(timing, now);
  updateCamera(timing, layout.graph);
  updatePanelColor();

  background(0);
  drawRightBackground(layout);
  drawLeftPanel(layout, timing, now);
  drawRightHeader(layout, timing, now);
  drawViewControls(layout);
  drawDailyGraph(layout, timing, now);
  drawRipples(layout, now);
  drawPrompts(layout, timing, now);
  drawCampaignOverlay(layout, timing, now);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  viewStartSecond = constrainViewStart(viewStartSecond, getCampaignTiming(Date.now()));
}

// -----------------------------------------------------------------------------
// CAMPAIGN STATE
// -----------------------------------------------------------------------------

function createEmptyState() {
  return {
    version: STATE_VERSION,
    campaignStartDate: CONFIG.CAMPAIGN_START_DATE,
    votes: [],
    lastLeader: 0,
    prompts: {
      dayIndex: null,
      nextIndex: 0,
      visible: [],
      lastShownAt: null,
      armedAt: null
    }
  };
}

function createInitialState() {
  const initial = createEmptyState();
  if (CONFIG.SEED_DEMO_DATA) initial.votes = createDemoVotesForYesterday();
  return initial;
}

function createDemoVotesForYesterday() {
  const votes = [];
  const yesPattern = [3, 2, 4, 1, 3, 2, 1, 4];
  const noPattern = [1, 3, 1, 2, 0, 4, 2, 1];
  const firstBucketSecond = 8 * 60 * 60;
  const bucketSpacingSeconds = 15 * 60;

  for (let bucketIndex = 0; bucketIndex < 48; bucketIndex++) {
    const second = firstBucketSecond + bucketIndex * bucketSpacingSeconds;
    const bucketTimestamp = campaignStartMs + second * 1000;
    const yesCount = yesPattern[bucketIndex % yesPattern.length];
    const noCount = noPattern[bucketIndex % noPattern.length];

    for (let index = 0; index < yesCount; index++) {
      votes.push([bucketTimestamp + index * 40, YES]);
    }

    for (let index = 0; index < noCount; index++) {
      votes.push([bucketTimestamp + (yesCount + index) * 40, NO]);
    }
  }

  return votes;
}

function clearLegacyCampaignStorage() {
  try {
    const currentKey = storageKey();
    const keysToRemove = [];

    for (let index = 0; index < localStorage.length; index++) {
      const keyName = localStorage.key(index);
      if (
        keyName &&
        keyName.startsWith(CONFIG.STORAGE_NAMESPACE) &&
        keyName !== currentKey
      ) {
        keysToRemove.push(keyName);
      }
    }

    for (const keyName of keysToRemove) localStorage.removeItem(keyName);
  } catch (error) {
    console.warn("Collective Pulse could not clear its previous campaign data.", error);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return createInitialState();

    const saved = JSON.parse(raw);
    if (
      !saved ||
      saved.version !== STATE_VERSION ||
      saved.campaignStartDate !== CONFIG.CAMPAIGN_START_DATE ||
      !Array.isArray(saved.votes)
    ) {
      return createInitialState();
    }

    const cleaned = createEmptyState();
    cleaned.votes = saved.votes
      .filter((vote) => (
        Array.isArray(vote) &&
        Number.isFinite(vote[0]) &&
        (vote[1] === YES || vote[1] === NO) &&
        vote[0] >= campaignStartMs &&
        vote[0] < campaignEndMs
      ))
      .map((vote) => [vote[0], vote[1]])
      .sort((a, b) => a[0] - b[0]);

    cleaned.lastLeader = saved.lastLeader === NO ? NO : saved.lastLeader === YES ? YES : 0;

    if (saved.prompts && typeof saved.prompts === "object") {
      const promptState = saved.prompts;
      cleaned.prompts.dayIndex = Number.isInteger(promptState.dayIndex)
        ? promptState.dayIndex
        : null;
      cleaned.prompts.nextIndex = Number.isInteger(promptState.nextIndex)
        ? ((promptState.nextIndex % PROMPTS.length) + PROMPTS.length) % PROMPTS.length
        : 0;
      cleaned.prompts.visible = Array.isArray(promptState.visible)
        ? promptState.visible
          .filter((item) => (
            Array.isArray(item) &&
            Number.isInteger(item[0]) &&
            item[0] >= 0 &&
            item[0] < PROMPTS.length &&
            Number.isFinite(item[1])
          ))
          .slice(-CONFIG.MAX_VISIBLE_PROMPTS)
        : [];
      cleaned.prompts.lastShownAt = Number.isFinite(promptState.lastShownAt)
        ? promptState.lastShownAt
        : null;
      cleaned.prompts.armedAt = Number.isFinite(promptState.armedAt)
        ? promptState.armedAt
        : null;
    }

    return cleaned;
  } catch (error) {
    console.warn("Collective Pulse could not restore its local state.", error);
    storageFailed = true;
    return createInitialState();
  }
}

function saveState() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
    storageFailed = false;
  } catch (error) {
    console.warn("Collective Pulse could not save its local state.", error);
    storageFailed = true;
  }
}

function storageKey() {
  return `${CONFIG.STORAGE_KEY}:${CONFIG.CAMPAIGN_START_DATE}`;
}

function rebuildDerived() {
  const days = Array.from({ length: CONFIG.CAMPAIGN_DAYS }, () => []);
  let yes = 0;
  let no = 0;
  let runningYes = 0;
  let runningNo = 0;
  let lastLeader = 0;

  for (const vote of state.votes) {
    const timestamp = vote[0];
    const choice = vote[1];
    const dayIndex = floor((timestamp - campaignStartMs) / CONFIG.DAY_MS);

    if (dayIndex < 0 || dayIndex >= CONFIG.CAMPAIGN_DAYS) continue;

    days[dayIndex].push(vote);

    if (choice === YES) {
      yes++;
      runningYes++;
    } else {
      no++;
      runningNo++;
    }

    if (runningYes > runningNo) lastLeader = YES;
    if (runningNo > runningYes) lastLeader = NO;
  }

  state.lastLeader = lastLeader || state.lastLeader || 0;

  derived = {
    yes,
    no,
    total: yes + no,
    days: days.map((votes, dayIndex) => buildDayData(votes, dayIndex))
  };
}

function buildDayData(votes, dayIndex) {
  const dayStart = campaignStartMs + dayIndex * CONFIG.DAY_MS;
  const groups = [];
  let currentGroup = null;
  let yes = 0;
  let no = 0;

  for (const vote of votes) {
    const second = constrain(
      floor((vote[0] - dayStart) / 1000),
      0,
      CONFIG.DAY_SECONDS - 1
    );

    if (!currentGroup || currentGroup.second !== second) {
      currentGroup = {
        second,
        events: [],
        yesCount: 0,
        noCount: 0,
        bars: [],
        startValue: 0,
        endValue: 0,
        lastChoiceAfter: 0
      };
      groups.push(currentGroup);
    }

    currentGroup.events.push(vote[1]);
    if (vote[1] === YES) {
      currentGroup.yesCount++;
      yes++;
    } else {
      currentGroup.noCount++;
      no++;
    }
  }

  let value = 0;
  let minValue = 0;
  let maxValue = 0;

  for (const group of groups) {
    group.startValue = value;
    group.bars = [
      { choice: YES, count: group.yesCount },
      { choice: NO, count: group.noCount }
    ].filter((bar) => bar.count > 0);

    for (const bar of group.bars) {
      value += bar.choice * bar.count;
      minValue = min(minValue, value);
      maxValue = max(maxValue, value);
    }

    group.endValue = value;
    group.lastChoiceAfter = group.bars[group.bars.length - 1].choice;
  }

  return {
    dayIndex,
    votes,
    groups,
    yes,
    no,
    total: votes.length,
    finalValue: value,
    minValue,
    maxValue
  };
}

function getCampaignTiming(now) {
  const rawDay = floor((now - campaignStartMs) / CONFIG.DAY_MS);
  const before = now < campaignStartMs;
  const complete = now >= campaignEndMs;
  const active = !before && !complete;
  const activeDayIndex = active ? constrain(rawDay, 0, CONFIG.CAMPAIGN_DAYS - 1) : null;
  const displayDayIndex = before
    ? 0
    : complete
      ? CONFIG.CAMPAIGN_DAYS - 1
      : activeDayIndex;
  const displayDayStart = campaignStartMs + displayDayIndex * CONFIG.DAY_MS;
  const liveSecond = before
    ? 0
    : complete
      ? CONFIG.DAY_SECONDS
      : constrain((now - displayDayStart) / 1000, 0, CONFIG.DAY_SECONDS);

  return {
    before,
    complete,
    active,
    activeDayIndex,
    displayDayIndex,
    displayDayStart,
    liveSecond
  };
}

function recordVote(choice) {
  const now = Date.now();
  const timing = getCampaignTiming(now);
  if (!timing.active) return false;

  state.votes.push([now, choice]);
  rebuildDerived();

  targetPanelColor = color(panelColorForTotals());
  ripples.push({ choice, bornAt: now });
  if (!fitAll) followLive = true;
  saveState();

  const status = document.getElementById("vote-status");
  if (status) {
    status.textContent = `${choice === YES ? "Yes" : "No"} recorded. ${derived.total} total responses.`;
  }

  return true;
}

function panelColorForTotals() {
  if (derived.yes > derived.no) return CONFIG.YES_COLOR;
  if (derived.no > derived.yes) return CONFIG.NO_COLOR;
  if (state.lastLeader === YES) return CONFIG.YES_COLOR;
  if (state.lastLeader === NO) return CONFIG.NO_COLOR;
  return CONFIG.TIE_PANEL_COLOR;
}

function updatePanelColor() {
  const desired = color(panelColorForTotals());
  targetPanelColor = desired;
  panelColor = lerpColor(panelColor, targetPanelColor, 0.1);
}

// -----------------------------------------------------------------------------
// PROMPTS
// -----------------------------------------------------------------------------

function handleDayChange(timing, now) {
  if (timing.activeDayIndex === lastFrameDayIndex) return;

  lastFrameDayIndex = timing.activeDayIndex;
  viewedDayIndex = timing.displayDayIndex;
  viewStartSecond = 0;
  followLive = !fitAll;
  ensurePromptDay(timing, now);
}

function ensurePromptDay(timing, now) {
  if (!timing.active) return;
  if (state.prompts.dayIndex === timing.activeDayIndex) return;

  state.prompts.dayIndex = timing.activeDayIndex;
  state.prompts.visible = [];
  state.prompts.lastShownAt = null;
  state.prompts.armedAt = now;
  saveState();
}

function updatePromptClock(timing, now) {
  if (!timing.active || PROMPTS.length === 0) return;

  ensurePromptDay(timing, now);
  const anchor = state.prompts.lastShownAt || state.prompts.armedAt || now;

  if (now - anchor >= CONFIG.PROMPT_INTERVAL_MS) {
    appendPrompt(now);
  }
}

function appendPrompt(now) {
  const promptIndex = state.prompts.nextIndex % PROMPTS.length;
  state.prompts.visible.push([promptIndex, now]);
  state.prompts.visible = state.prompts.visible.slice(-CONFIG.MAX_VISIBLE_PROMPTS);
  state.prompts.nextIndex = (promptIndex + 1) % PROMPTS.length;
  state.prompts.lastShownAt = now;
  state.prompts.armedAt = now;
  lastPromptAddedAt = millis();
  saveState();
}

// -----------------------------------------------------------------------------
// LAYOUT
// -----------------------------------------------------------------------------

function getLayout() {
  const sx = width / 1920;
  const sy = height / 1080;
  const ui = constrain(min(sx, sy), 0.55, 1.5);
  const leftW = 455 * sx;
  const pad = 33 * sx;
  const rightPad = 44 * sx;
  const rightX = leftW;
  const rightW = width - leftW;

  const graph = {
    x: 499 * sx,
    y: 322 * sy,
    w: 1326 * sx,
    h: 363 * sy
  };

  return {
    sx,
    sy,
    ui,
    leftW,
    pad,
    rightX,
    rightW,
    rightPad,
    graph,
    prompt: {
      timestampX: 1174 * sx,
      lineX: 1259 * sx,
      questionX: 1349 * sx,
      y: 893 * sy,
      w: 520 * sx,
      rowH: 37 * sy
    }
  };
}

function drawRightBackground(layout) {
  noStroke();
  fill(0);
  rect(layout.rightX, 0, layout.rightW, height);
}

// -----------------------------------------------------------------------------
// LEFT OVERVIEW
// -----------------------------------------------------------------------------

function drawLeftPanel(layout, timing, now) {
  noStroke();
  fill(panelColor);
  rect(0, 0, layout.leftW, height);

  const x = 33 * layout.sx;
  const contentW = 389 * layout.sx;
  const ui = layout.ui;

  fill(0);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(20 * ui);
  text("COLLECTIVE PULSE", x, 37 * layout.sy);

  textStyle(NORMAL);
  textSize(20 * ui);
  textLeading(24 * ui);
  textWrap(WORD);
  text(
    "Vietnam's creative community is growing rapidly. Collective Pulse installation asks what kind of future we want to build for design in Vietnam.",
    x,
    95 * layout.sy,
    contentW,
    112 * layout.sy
  );
  text(
    "Come & make your choice. Your response becomes part of the collective dataset.",
    x,
    225 * layout.sy,
    contentW,
    60 * layout.sy
  );

  drawLeftRule(layout, 299 * layout.sy);

  textStyle(BOLD);
  textSize(20 * ui);
  text("LIVE RESPONSE", 37 * layout.sx, 330 * layout.sy);

  textStyle(NORMAL);
  textSize(20 * ui);
  text(`${derived.total.toLocaleString()} responses`, 37 * layout.sx, 382 * layout.sy);

  const lastSecond = countVotesSince(now - 1000, now);
  textStyle(ITALIC);
  textAlign(LEFT, TOP);
  text(`+ ${lastSecond} responses/s`, 270 * layout.sx, 382 * layout.sy);

  const yesPercent = derived.total ? round((derived.yes / derived.total) * 100) : 0;
  const noPercent = derived.total ? 100 - yesPercent : 0;
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  textSize(20 * ui);
  text(`YES ${yesPercent}%`, 37 * layout.sx, 434 * layout.sy);
  text(`NO ${noPercent}%`, 37 * layout.sx, 458 * layout.sy);

  drawLeftRule(layout, 526 * layout.sy);

  textStyle(BOLD);
  textSize(20 * ui);
  text("Overall view", 37 * layout.sx, 785 * layout.sy);
  textStyle(NORMAL);
  text("from the past", 164 * layout.sx, 785 * layout.sy);
  textStyle(ITALIC);
  text(formatCampaignElapsed(now), 300 * layout.sx, 785 * layout.sy);
  drawOverviewGraph(layout, timing);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
}

function drawLeftRule(layout, y) {
  stroke(0, 62);
  strokeWeight(1);
  line(33 * layout.sx, y, 422 * layout.sx, y);
}

function drawOverviewGraph(layout, timing) {
  const x = 33 * layout.sx;
  const y = 847 * layout.sy;
  const w = 389 * layout.sx;
  const h = 216 * layout.sy;
  const baseline = 992 * layout.sy;

  stroke(0, 55);
  strokeWeight(1);
  line(x, baseline, x + w, baseline);

  if (state.votes.length > 0) {
    let value = 0;
    let maxAbs = 1;
    for (const vote of state.votes) {
      value += vote[1];
      maxAbs = max(maxAbs, abs(value));
    }

    const yScale = (h * 0.46) / maxAbs;
    value = 0;
    let previousX = x;
    let previousY = baseline;

    const stride = max(1, ceil(state.votes.length / 1800));
    for (let i = 0; i < state.votes.length; i++) {
      const vote = state.votes[i];
      value += vote[1];
      if (i % stride !== 0 && i !== state.votes.length - 1) continue;

      const progress = constrain(
        (vote[0] - campaignStartMs) / (campaignEndMs - campaignStartMs),
        0,
        1
      );
      const sx = x + progress * w;
      const sy = baseline - value * yScale;

      stroke(0);
      strokeWeight(2 * layout.ui);
      line(previousX, previousY, sx, sy);
      previousX = sx;
      previousY = sy;
    }

    noStroke();
    fill(0);
    circle(previousX, previousY, 6 * layout.ui);
  }

  const campaignProgress = constrain(
    (Date.now() - campaignStartMs) / (campaignEndMs - campaignStartMs),
    0,
    1
  );
  const cursorX = x + campaignProgress * w;
  stroke(0, 175);
  strokeWeight(2 * layout.ui);
  line(cursorX, y + 36 * layout.sy, cursorX, y + h - 28 * layout.sy);
  noStroke();
  fill(0);
  circle(cursorX, y + 36 * layout.sy, 6 * layout.ui);

  textAlign(LEFT, TOP);
}

// -----------------------------------------------------------------------------
// RIGHT PANEL / DAILY GRAPH
// -----------------------------------------------------------------------------

function drawRightHeader(layout, timing) {
  const x = 499 * layout.sx;
  const ui = layout.ui;

  noStroke();
  fill(245);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  textSize(90 * ui);
  textLeading(99 * ui);
  text("Does Vietnam need an\nannual Design Festival?", x, 59 * layout.sy);

  if (storageFailed) {
    fill(CONFIG.NO_COLOR);
    textSize(14 * ui);
    textAlign(RIGHT, TOP);
    text("LOCAL SAVE ERROR", width - 47 * layout.sx, 37 * layout.sy);
  }

  textAlign(LEFT, TOP);
  textStyle(NORMAL);
}

function drawViewControls(layout) {
  const controls = viewControlRects(layout);
  drawViewControl(controls.zoomOut, "−", false, layout.ui);
  drawViewControl(controls.zoomIn, "+", false, layout.ui);
  drawViewControl(controls.live, "LIVE", !fitAll && followLive, layout.ui);
  drawViewControl(controls.fitAll, "FIT ALL", fitAll, layout.ui);
}

function drawViewControl(rectData, label, active, ui) {
  stroke(active ? 245 : 105);
  strokeWeight(1);
  fill(active ? 245 : 0);
  rect(rectData.x, rectData.y, rectData.w, rectData.h);

  noStroke();
  fill(active ? 0 : 155);
  textStyle(BOLD);
  textSize(12 * ui);
  textAlign(CENTER, CENTER);
  text(label, rectData.x + rectData.w * 0.5, rectData.y + rectData.h * 0.5);
  textStyle(NORMAL);
  textAlign(LEFT, TOP);
}

function viewControlRects(layout) {
  const ui = layout.ui;
  const fitWidth = 82 * ui;
  const liveWidth = 56 * ui;
  const zoomWidth = 30 * ui;
  const gap = 8 * ui;
  const y = 286 * layout.sy;
  const right = layout.graph.x + layout.graph.w;
  const liveX = right - fitWidth - gap - liveWidth;

  return {
    zoomOut: {
      x: liveX - gap - zoomWidth * 2,
      y,
      w: zoomWidth,
      h: 24 * ui
    },
    zoomIn: {
      x: liveX - gap - zoomWidth,
      y,
      w: zoomWidth,
      h: 24 * ui
    },
    live: {
      x: liveX,
      y,
      w: liveWidth,
      h: 24 * ui
    },
    fitAll: {
      x: right - fitWidth,
      y,
      w: fitWidth,
      h: 24 * ui
    }
  };
}

function drawDailyGraph(layout, timing, now) {
  const graph = layout.graph;
  const dayData = derived.days[timing.displayDayIndex];
  timelineSecondWidth = secondWidthForView(graph, timing);
  const viewEnd = viewStartSecond + graph.w / timelineSecondWidth;
  const baseline = graph.y + graph.h - 29 * layout.sy;
  const positiveScale = dayData.maxValue > 0
    ? (baseline - graph.y - 18 * layout.sy) / dayData.maxValue
    : 31 * layout.ui;
  const negativeScale = dayData.minValue < 0
    ? (graph.y + graph.h - baseline - 6 * layout.sy) / abs(dayData.minValue)
    : 31 * layout.ui;
  const yScale = max(0.1, min(31 * layout.ui, positiveScale, negativeScale));

  drawGraphAxes(layout, timing, dayData, baseline, viewEnd, yScale);

  const ctx = drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.rect(graph.x, graph.y, graph.w, graph.h);
  ctx.clip();

  drawGraphSecondStems(layout, timing, dayData, viewEnd, baseline, yScale);
  drawVoteTrace(layout, timing, dayData, viewEnd, baseline, yScale);
  drawLiveCursor(layout, timing, baseline);

  ctx.restore();

  drawGraphTimestamps(layout, timing, dayData, viewEnd);
}

function drawGraphAxes(layout, timing, dayData, baseline, viewEnd, yScale) {
  const graph = layout.graph;
  const ui = layout.ui;

  stroke(112);
  strokeWeight(1);
  line(graph.x, graph.y + graph.h, 1873 * layout.sx, graph.y + graph.h);
  line(graph.x, graph.y + graph.h, graph.x, graph.y);
  line(graph.x, graph.y, graph.x - 4 * ui, graph.y + 6 * ui);
  line(graph.x, graph.y, graph.x + 4 * ui, graph.y + 6 * ui);
  line(1873 * layout.sx, graph.y + graph.h, 1867 * layout.sx, graph.y + graph.h - 4 * ui);
  line(1873 * layout.sx, graph.y + graph.h, 1867 * layout.sx, graph.y + graph.h + 4 * ui);

  noStroke();
  fill(130);
  textSize(14 * ui);
  textAlign(LEFT, CENTER);
  push();
  translate(478 * layout.sx, 405 * layout.sy);
  rotate(-HALF_PI);
  text("YES responses (%)", 0, 0);
  pop();
  text("Time", 1881 * layout.sx, 698 * layout.sy);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
}

function drawGraphSecondStems(layout, timing, dayData, viewEnd, baseline, yScale) {
  const graph = layout.graph;
  const tickStep = timelineTickStep(timelineSecondWidth);
  const first = max(0, ceil(viewStartSecond / tickStep) * tickStep);
  const last = min(ceil(viewEnd), floor(timing.liveSecond));
  let groupIndex = lowerBoundGroup(dayData.groups, first);
  let value = groupIndex > 0 ? dayData.groups[groupIndex - 1].endValue : 0;
  const ctx = drawingContext;

  ctx.save();
  ctx.setLineDash([5 * layout.ui, 6 * layout.ui]);
  stroke(255, 58);
  strokeWeight(1);

  for (let second = first; second <= last; second += tickStep) {
    while (
      groupIndex < dayData.groups.length &&
      dayData.groups[groupIndex].second <= second
    ) {
      value = dayData.groups[groupIndex].endValue;
      groupIndex++;
    }

    const x = xForSecond(second, graph);
    const y = baseline - value * yScale;
    line(x, y, x, graph.y + graph.h);
  }

  ctx.restore();
}

function drawVoteTrace(layout, timing, dayData, viewEnd, baseline, yScale) {
  const graph = layout.graph;
  const groups = dayData.groups;
  const firstIndex = lowerBoundGroup(groups, floor(viewStartSecond));
  let value = firstIndex > 0 ? groups[firstIndex - 1].endValue : 0;
  let lastChoice = firstIndex > 0 ? groups[firstIndex - 1].lastChoiceAfter : 0;
  let cursorSecond = viewStartSecond;

  for (let i = firstIndex; i < groups.length; i++) {
    const group = groups[i];
    if (group.second > viewEnd) break;

    if (group.second > cursorSecond) {
      drawPlateau(
        max(cursorSecond, viewStartSecond),
        min(group.second, viewEnd),
        value,
        lastChoice,
        graph,
        baseline,
        yScale,
        layout.ui
      );
    }

    const barCount = group.bars.length;
    for (let barIndex = 0; barIndex < barCount; barIndex++) {
      const bar = group.bars[barIndex];
      const choice = bar.choice;
      const bounds = choiceBarBounds(group.second, barIndex, barCount);
      const subStart = bounds.start;
      const subEnd = bounds.end;

      if (subEnd <= viewStartSecond) {
        value += choice * bar.count;
        lastChoice = choice;
        cursorSecond = subEnd;
        continue;
      }

      if (subStart >= viewEnd) break;

      const oldValue = value;
      value += choice * bar.count;

      const visibleStart = max(subStart, viewStartSecond);
      const visibleEnd = min(subEnd, viewEnd);
      drawVoteSegment(
        visibleStart,
        visibleEnd,
        oldValue,
        value,
        choice,
        graph,
        baseline,
        yScale,
        layout.ui
      );

      lastChoice = choice;
      cursorSecond = subEnd;
    }
  }

  const traceEnd = min(timing.liveSecond, viewEnd);
  if (traceEnd > cursorSecond) {
    drawPlateau(
      max(cursorSecond, viewStartSecond),
      traceEnd,
      value,
      lastChoice,
      graph,
      baseline,
      yScale,
      layout.ui
    );
  }

  if (timing.liveSecond >= viewStartSecond && timing.liveSecond <= viewEnd) {
    const x = xForSecond(timing.liveSecond, graph);
    const y = baseline - dayData.finalValue * yScale;
    noStroke();
    fill(248);
    circle(x, y, 9 * layout.ui);
  }
}

function choiceBarBounds(second, barIndex, barCount) {
  return {
    start: second + barIndex / barCount,
    end: second + (barIndex + 1) / barCount
  };
}

function drawVoteSegment(startSecond, endSecond, oldValue, value, choice, graph, baseline, yScale, ui) {
  if (endSecond <= startSecond) return;
  const x1 = xForSecond(startSecond, graph);
  const x2 = xForSecond(endSecond, graph);
  const oldY = baseline - oldValue * yScale;
  const newY = baseline - value * yScale;

  noStroke();
  fill(choiceColor(choice));
  rect(x1, min(oldY, newY), max(1, x2 - x1), max(3 * ui, abs(newY - oldY)));
}

function drawPlateau(startSecond, endSecond, value, choice, graph, baseline, yScale, ui) {
  if (endSecond <= startSecond) return;
  const x1 = xForSecond(startSecond, graph);
  const x2 = xForSecond(endSecond, graph);
  const y = baseline - value * yScale;
  const plateauColor = choice === NO ? color(CONFIG.NO_COLOR) : color(CONFIG.YES_COLOR);
  plateauColor.setAlpha(choice === 0 ? 28 : 42);
  const bandHeight = constrain(abs(yScale), 6 * ui, 31 * ui);

  noStroke();
  fill(plateauColor);
  rect(x1, y - bandHeight * 0.5, max(1, x2 - x1), bandHeight);
}

function drawLiveCursor(layout, timing) {
  const graph = layout.graph;
  if (timing.liveSecond < viewStartSecond) return;
  const x = xForSecond(timing.liveSecond, graph);
  if (x < graph.x || x > graph.x + graph.w) return;

  stroke(245, 115);
  strokeWeight(1);
  line(x, graph.y, x, graph.y + graph.h);
}

function drawGraphTimestamps(layout, timing, dayData, viewEnd) {
  const graph = layout.graph;
  const ui = layout.ui;
  const tickStep = timelineTickStep(timelineSecondWidth);
  const first = max(0, ceil(viewStartSecond / tickStep) * tickStep);
  const last = min(ceil(viewEnd), floor(timing.liveSecond));

  noStroke();
  fill(255, 128);
  textSize(14 * ui);
  textAlign(LEFT, CENTER);

  for (let second = first; second <= last; second += tickStep) {
    const x = xForSecond(second, graph);
    push();
    translate(x + 6 * ui, 698 * layout.sy);
    rotate(HALF_PI);
    text(formatClock(timing.displayDayStart + second * 1000), 0, 0);
    pop();
  }

  textAlign(LEFT, TOP);
}

function xForSecond(second, graph) {
  return graph.x + (second - viewStartSecond) * timelineSecondWidth;
}

function secondWidthForView(graph, timing) {
  if (!fitAll) return zoomSecondWidth;
  return graph.w / max(1, timing.liveSecond);
}

function timelineTickStep(secondWidth) {
  const targetSeconds = 72 / max(secondWidth, 0.0001);
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 21600];
  return steps.find((step) => step >= targetSeconds) || CONFIG.DAY_SECONDS;
}

function lowerBoundGroup(groups, targetSecond) {
  let low = 0;
  let high = groups.length;

  while (low < high) {
    const middle = (low + high) >> 1;
    if (groups[middle].second < targetSecond) low = middle + 1;
    else high = middle;
  }

  return low;
}

function countVotesSince(startTimestamp, endTimestamp) {
  const votes = state.votes;
  let low = 0;
  let high = votes.length;

  while (low < high) {
    const middle = (low + high) >> 1;
    if (votes[middle][0] < startTimestamp) low = middle + 1;
    else high = middle;
  }

  let count = 0;
  for (let i = low; i < votes.length && votes[i][0] <= endTimestamp; i++) {
    count++;
  }
  return count;
}

function choiceColor(choice) {
  return choice === NO ? CONFIG.NO_COLOR : CONFIG.YES_COLOR;
}

// -----------------------------------------------------------------------------
// CAMERA / SCROLLING
// -----------------------------------------------------------------------------

function updateCamera(timing, graph) {
  if (viewedDayIndex !== timing.displayDayIndex) {
    viewedDayIndex = timing.displayDayIndex;
    viewStartSecond = 0;
    followLive = !fitAll;
  }

  if (fitAll) {
    viewStartSecond = 0;
    return;
  }

  const visibleSeconds = graph.w / secondWidthForView(graph, timing);

  if (followLive) {
    viewStartSecond = max(0, timing.liveSecond - visibleSeconds);
  }

  viewStartSecond = constrainViewStart(viewStartSecond, timing, visibleSeconds);
}

function constrainViewStart(value, timing, suppliedVisibleSeconds = null) {
  const graph = getLayout().graph;
  const visibleSeconds = suppliedVisibleSeconds || graph.w / secondWidthForView(graph, timing);
  const availableEnd = timing.complete ? CONFIG.DAY_SECONDS : timing.liveSecond;
  const maxStart = max(0, availableEnd - visibleSeconds * 0.08);
  return constrain(value, 0, maxStart);
}

// -----------------------------------------------------------------------------
// PROMPTS / VOTE WATER-DROP BACKGROUND
// -----------------------------------------------------------------------------

function drawRipples(layout, nowMillis) {
  ripples = ripples.filter((ripple) => nowMillis - ripple.bornAt < CONFIG.VOTE_RIPPLE_MS);
  if (ripples.length === 0) return;

  const centerX = 1514 * layout.sx;
  const centerY = 1156 * layout.sy;
  const ctx = drawingContext;

  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.rightX, 568 * layout.sy, layout.rightW, height - 568 * layout.sy);
  ctx.clip();

  for (const ripple of ripples) {
    const age = nowMillis - ripple.bornAt;
    const progress = constrain(age / CONFIG.VOTE_RIPPLE_MS, 0, 1);
    const eased = 1 - pow(1 - progress, 3);
    const radius = lerp(18, CONFIG.VOTE_RIPPLE_MAX_RADIUS * layout.ui, eased);
    const opacity = pow(1 - progress, 1.35) * 0.92;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

    if (ripple.choice === YES) {
      gradient.addColorStop(0, CONFIG.YES_COLOR);
      gradient.addColorStop(1, "rgba(155, 180, 255, 0)");
    } else {
      gradient.addColorStop(0, CONFIG.NO_COLOR);
      gradient.addColorStop(1, "rgba(234, 112, 112, 0)");
    }

    ctx.globalAlpha = opacity;
    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  }

  ctx.restore();
}

function drawPrompts(layout, timing, now) {
  const p = layout.prompt;
  const ui = layout.ui;

  const visible = state.prompts.visible;
  if (visible.length === 0) return;

  const newestAnimation = constrain((millis() - lastPromptAddedAt) / 700, 0, 1);

  for (let i = 0; i < visible.length; i++) {
    const item = visible[i];
    const isNewest = i === visible.length - 1;
    const alphaLevels = [102, 128, 153, 245];
    const rowSlot = CONFIG.MAX_VISIBLE_PROMPTS - visible.length + i;
    const alpha = alphaLevels[rowSlot];
    const enterOffset = isNewest ? (1 - easeOutCubic(newestAnimation)) * 18 * ui : 0;
    const y = p.y + rowSlot * p.rowH + enterOffset;

    fill(255, isNewest ? 153 : alpha);
    textAlign(LEFT, CENTER);
    textSize(16 * ui);
    text(formatClock(item[1]), p.timestampX, y);

    stroke(255, alpha);
    strokeWeight(2 * ui);
    line(p.lineX, y, p.lineX + 60 * layout.sx, y);

    noStroke();
    fill(255, alpha);
    const question = PROMPTS[item[0]];
    textSize(fittedTextSize(question, p.w, 24 * ui, 14 * ui));
    textAlign(LEFT, CENTER);
    text(question, p.questionX, y);
  }

  textAlign(LEFT, TOP);
  textStyle(NORMAL);
}

function easeOutCubic(value) {
  return 1 - pow(1 - value, 3);
}

function fittedTextSize(value, availableWidth, preferredSize, minimumSize) {
  let size = preferredSize;
  textSize(size);

  while (size > minimumSize && textWidth(value) > availableWidth) {
    size -= 0.5;
    textSize(size);
  }

  return size;
}

// -----------------------------------------------------------------------------
// CAMPAIGN OVERLAYS
// -----------------------------------------------------------------------------

function drawCampaignOverlay(layout, timing) {
  if (timing.active) return;

  const graph = layout.graph;
  const ui = layout.ui;
  const boxW = min(graph.w * 0.58, 620 * ui);
  const boxH = 104 * ui;
  const x = graph.x + (graph.w - boxW) * 0.5;
  const y = graph.y + graph.h * 0.34;

  noStroke();
  fill(0, 218);
  rect(x, y, boxW, boxH);
  stroke(115);
  strokeWeight(1);
  noFill();
  rect(x, y, boxW, boxH);

  noStroke();
  fill(240);
  textAlign(CENTER, CENTER);
  textStyle(NORMAL);
  textSize(25 * ui);
  text(
    timing.before
      ? `CAMPAIGN BEGINS  ${formatDate(campaignStartMs)}`
      : "SEVEN-DAY CAMPAIGN COMPLETE",
    x + boxW * 0.5,
    y + boxH * 0.43
  );
  fill(135);
  textSize(13 * ui);
  text(
    timing.before ? "Voting is not open yet" : "Final responses are preserved on this kiosk",
    x + boxW * 0.5,
    y + boxH * 0.72
  );

  textAlign(LEFT, TOP);
  textStyle(NORMAL);
}

// -----------------------------------------------------------------------------
// INPUT
// -----------------------------------------------------------------------------

function keyPressed(event) {
  if (event && event.repeat) return false;

  if (key === "f" || key === "F") {
    activateFitAll();
    return false;
  }

  if (key === "l" || key === "L") {
    activateLiveView();
    return false;
  }

  if (key === "+" || key === "=") {
    zoomTimeline(CONFIG.ZOOM_FACTOR, getLayout(), getCampaignTiming(Date.now()));
    return false;
  }

  if (key === "-" || key === "_") {
    zoomTimeline(1 / CONFIG.ZOOM_FACTOR, getLayout(), getCampaignTiming(Date.now()));
    return false;
  }

  if (keyCode === LEFT_ARROW) {
    recordVote(YES);
    return false;
  }

  if (keyCode === RIGHT_ARROW) {
    recordVote(NO);
    return false;
  }

  return true;
}

function mousePressed() {
  const layout = getLayout();
  const controls = viewControlRects(layout);

  if (pointInRect(mouseX, mouseY, controls.fitAll)) {
    activateFitAll();
    return false;
  }

  if (pointInRect(mouseX, mouseY, controls.live)) {
    activateLiveView();
    return false;
  }

  if (pointInRect(mouseX, mouseY, controls.zoomOut)) {
    zoomTimeline(1 / CONFIG.ZOOM_FACTOR, layout, getCampaignTiming(Date.now()));
    return false;
  }

  if (pointInRect(mouseX, mouseY, controls.zoomIn)) {
    zoomTimeline(CONFIG.ZOOM_FACTOR, layout, getCampaignTiming(Date.now()));
    return false;
  }

  if (pointInRect(mouseX, mouseY, layout.graph)) {
    fitAll = false;
    followLive = false;
    dragState = {
      startMouseX: mouseX,
      startViewSecond: viewStartSecond
    };
    return false;
  }

  return true;
}

function mouseDragged() {
  if (!dragState) return true;

  const deltaSeconds = (dragState.startMouseX - mouseX) / zoomSecondWidth;
  viewStartSecond = constrainViewStart(
    dragState.startViewSecond + deltaSeconds,
    getCampaignTiming(Date.now())
  );
  return false;
}

function mouseReleased() {
  dragState = null;
}

function doubleClicked() {
  if (pointInRect(mouseX, mouseY, getLayout().graph)) {
    activateLiveView();
    return false;
  }
  return true;
}

function mouseWheel(event) {
  const layout = getLayout();
  if (!pointInRect(mouseX, mouseY, layout.graph)) return true;

  const timing = getCampaignTiming(Date.now());
  if (event.ctrlKey || event.metaKey) {
    const factor = event.deltaY < 0 ? CONFIG.ZOOM_FACTOR : 1 / CONFIG.ZOOM_FACTOR;
    zoomTimeline(factor, layout, timing, mouseX);
    return false;
  }

  fitAll = false;
  followLive = false;
  const wheelDelta = abs(event.deltaX) > abs(event.deltaY) ? event.deltaX : event.deltaY;
  const currentWidth = secondWidthForView(layout.graph, timing);
  viewStartSecond = constrainViewStart(
    viewStartSecond + wheelDelta * 0.12 * (CONFIG.SECOND_WIDTH / currentWidth),
    timing
  );
  return false;
}

function zoomTimeline(factor, layout, timing, anchorX = null) {
  const graph = layout.graph;
  const oldWidth = secondWidthForView(graph, timing);
  const oldStart = fitAll ? 0 : viewStartSecond;
  const wasFollowingLive = !fitAll && followLive;
  const anchor = constrain(anchorX ?? graph.x + graph.w * 0.5, graph.x, graph.x + graph.w);
  const anchorSecond = oldStart + (anchor - graph.x) / oldWidth;
  const minimumWidth = graph.w / CONFIG.DAY_SECONDS;

  zoomSecondWidth = constrain(
    oldWidth * factor,
    minimumWidth,
    CONFIG.MAX_SECOND_WIDTH * layout.ui
  );
  fitAll = false;
  followLive = wasFollowingLive;

  if (followLive) {
    updateCamera(timing, graph);
    return;
  }

  viewStartSecond = constrainViewStart(
    anchorSecond - (anchor - graph.x) / zoomSecondWidth,
    timing,
    graph.w / zoomSecondWidth
  );
}

function activateFitAll() {
  fitAll = true;
  followLive = false;
  viewStartSecond = 0;
}

function activateLiveView() {
  fitAll = false;
  followLive = true;
}

function pointInRect(px, py, rectData) {
  return (
    px >= rectData.x &&
    px <= rectData.x + rectData.w &&
    py >= rectData.y &&
    py <= rectData.y + rectData.h
  );
}

// -----------------------------------------------------------------------------
// FORMATTING
// -----------------------------------------------------------------------------

function formatClock(timestamp) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  return formatter.format(new Date(timestamp));
}

function formatDate(timestamp) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  return formatter.format(new Date(timestamp));
}

function formatCampaignElapsed(now) {
  const totalSeconds = floor(constrain(
    now - campaignStartMs,
    0,
    campaignEndMs - campaignStartMs
  ) / 1000);
  const hours = floor(totalSeconds / 3600);
  const minutes = floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

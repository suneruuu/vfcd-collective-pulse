const fs = require("fs");
const path = require("path");
const vm = require("vm");

const memory = {};
const drawingEvents = [];
let nowMs = 0;
class TestDate extends Date {
  static now() {
    return nowMs;
  }
}
const context = {
  console,
  Math,
  Date: TestDate,
  Intl,
  Object,
  Array,
  Number,
  JSON,
  String,
  localStorage: {
    getItem: (key) => memory[key] ?? null,
    setItem: (key, value) => {
      memory[key] = value;
    },
    removeItem: (key) => {
      delete memory[key];
    },
    key: (index) => Object.keys(memory)[index] ?? null,
    get length() {
      return Object.keys(memory).length;
    },
  },
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  pow: Math.pow,
  color: (value) => ({ value, setAlpha() {} }),
  noStroke: () => {},
  fill: () => {},
  stroke: () => {},
  strokeWeight: () => {},
  rect: (...args) => drawingEvents.push({ type: "rect", args }),
  circle: (...args) => drawingEvents.push({ type: "circle", args }),
  line: (...args) => drawingEvents.push({ type: "line", args }),
  drawingContext: { save() {}, restore() {}, setLineDash() {} },
  drawingEvents,
  document: { getElementById: () => null },
  LEFT_ARROW: 37,
  RIGHT_ARROW: 39,
  key: "",
  keyCode: 0,
  setTestClock: (now) => {
    nowMs = now;
  },
  constrain: (value, low, high) => Math.min(high, Math.max(low, value)),
  millis: () => 0,
};

vm.createContext(context);
require("./helpers/runtime-context.cjs").installContext(context);

const checks = `
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  campaignStartMs = new Date(
    CONFIG.CAMPAIGN_START_DATE + "T00:00:00" + CONFIG.CAMPAIGN_TIMEZONE_OFFSET
  ).getTime();
  campaignEndMs = campaignStartMs + CONFIG.CAMPAIGN_DAYS * CONFIG.DAY_MS;
  assert(CONFIG.CAMPAIGN_START_DATE === "2026-09-14", "the testing week must begin Monday, 14 September");
  assert(CONFIG.CAMPAIGN_DAYS === 7, "voting must remain a one-week campaign");
  const todayTiming = getCampaignTiming(new Date("2026-09-16T12:00:00+07:00").getTime());
  assert(todayTiming.active && todayTiming.displayDayIndex === 2, "Wednesday, 16 September must be the active third testing day");

  let base = campaignStartMs + 10000;
  assert(createInitialState().votes.length === 0, "a cleared campaign must start empty without reseeding demo votes");
  const seeded = { votes: createDemoVotesForYesterday() };
  assert(seeded.votes.length === 204, "the optional demo generator must still produce 204 votes");
  assert(
    seeded.votes.every((vote) => vote[0] >= campaignStartMs && vote[0] < campaignStartMs + CONFIG.DAY_MS),
    "every preview vote must belong to yesterday"
  );
  const seededDay = buildDayData(seeded.votes, 0);
  assert(seededDay.groups[0].bars[0].count === 3, "the first seed bucket must show a three-vote YES bar");
  assert(seededDay.groups[0].bars[1].count === 1, "the first seed bucket must show a one-vote NO bar");

  localStorage.setItem("collective_pulse_v1:old", "legacy");
  localStorage.setItem("collective_pulse_v2:" + CONFIG.CAMPAIGN_START_DATE, "old votes and prompts");
  localStorage.setItem("collective_pulse_v3:" + CONFIG.CAMPAIGN_START_DATE, "previous active votes and prompts");
  localStorage.setItem("unrelated_app", "keep");
  localStorage.setItem("p5_12hour_input_wave_second_resolution_v2", "reference sketch data");
  localStorage.setItem(storageKey(), "current");
  localStorage.setItem(CONFIG.STORAGE_KEY + ":2026-09-16", "previous saved session");
  localStorage.setItem(CONFIG.STORAGE_KEY + ":2026-09-21", "event week saved session");
  clearLegacyCampaignStorage();
  assert(localStorage.getItem("collective_pulse_v1:old") === null, "legacy campaign data must be cleared");
  assert(localStorage.getItem("collective_pulse_v2:" + CONFIG.CAMPAIGN_START_DATE) === null, "the previously active campaign's saved votes and prompts must be removed");
  assert(localStorage.getItem("collective_pulse_v3:" + CONFIG.CAMPAIGN_START_DATE) === null, "the v3 campaign must be cleared for the new centered-zero session");
  assert(localStorage.getItem("unrelated_app") === "keep", "clearing Collective Pulse must not affect unrelated browser data");
  assert(localStorage.getItem("p5_12hour_input_wave_second_resolution_v2") === "reference sketch data", "the program 2 reference sketch's saved data must be preserved");
  assert(localStorage.getItem(storageKey()) === "current", "the active campaign namespace must be retained");
  assert(localStorage.getItem(CONFIG.STORAGE_KEY + ":2026-09-16") === "previous saved session", "shifting the testing start must preserve the previous saved session");
  assert(localStorage.getItem(CONFIG.STORAGE_KEY + ":2026-09-21") === "event week saved session", "switching weeks must preserve the event week saved session");
  localStorage.removeItem(storageKey());
  assert(loadState().votes.length === 0, "loading after the reset must show zero responses");
  state = createEmptyState();
  state.votes = [[base, YES]];
  saveState();
  clearLegacyCampaignStorage();
  assert(loadState().votes.length === 1, "later reloads must retain newly collected responses instead of resetting repeatedly");

  const day = buildDayData([
    [base, YES],
    [base + 10, YES],
    [base + 20, NO]
  ], 0);

  assert(day.groups.length === 1, "votes in one second must share one group");
  assert(day.groups[0].events.length === 3, "the second must retain all three votes");
  assert(day.finalValue === 5, "two YES and one NO must finish five logical pixels above zero");

  assert(day.groups[0].bars.length === 2, "one second must contain at most one bar per choice");
  assert(day.groups[0].bars[0].choice === YES, "the YES aggregate must be the first bar");
  assert(day.groups[0].bars[0].count === 2, "the YES bar must aggregate both YES votes");
  assert(day.groups[0].bars[1].choice === NO, "the NO aggregate must be the second bar");
  assert(day.groups[0].bars[1].count === 1, "the NO bar must aggregate the NO vote");

  const ratioDay = buildDayData([
    [base, NO],
    [base + 10, YES],
    [base + 20, YES],
    [base + 30, YES]
  ], 0);
  const ratioBars = ratioDay.groups[0].bars;
  assert(ratioBars.length === 2, "three YES and one NO must render as two aggregate bars");
  assert(ratioBars[0].choice === YES && ratioBars[0].count === 3, "YES must occupy one three-vote bar");
  assert(ratioBars[1].choice === NO && ratioBars[1].count === 1, "NO must occupy one one-vote bar");
  const yesBounds = choiceBarBounds(10, 0, ratioBars.length);
  const noBounds = choiceBarBounds(10, 1, ratioBars.length);
  assert(yesBounds.end - yesBounds.start === 1 / 2, "YES must occupy half of the second");
  assert(noBounds.end - noBounds.start === 1 / 2, "NO must occupy half of the second");
  assert(ratioBars[0].count === 3, "YES height must still represent three votes");
  assert(ratioBars[1].count === 1, "NO height must still represent one vote");

  state = createEmptyState();
  rebuildDerived();
  const graphBase = base;
  base += CONFIG.OPEN_HOUR * 3600000;
  setTestClock(base);
  resetInputSampling();
  keyCode = LEFT_ARROW;
  keyPressed({ repeat: false });
  assert(state.votes.length === 0, "a press must wait for the next one-second sample");
  setTestClock(base + 100);
  keyReleased();
  updateInputSampling(base + 999);
  assert(state.votes.length === 0, "sampling must not fire early");
  setTestClock(base + 1000);
  updateInputSampling();
  assert(derived.yes === 1 && derived.days[0].finalValue === 5, "a short LEFT tap must move up by five once");
  updateInputSampling(base + 3000);
  assert(derived.total === 1, "idle seconds must hold the value without adding votes");

  setTestClock(base + 3100);
  keyCode = RIGHT_ARROW;
  keyPressed({ repeat: false });
  setTestClock(base + 3500);
  keyPressed({ repeat: true });
  assert(derived.total === 1, "browser key repeat must not create extra samples");
  setTestClock(base + 6000);
  updateInputSampling();
  assert(derived.no === 3, "a held RIGHT arrow must record one NO per second, including skipped frames");
  assert(derived.days[0].finalValue === -10, "three DOWN samples after one UP must reach minus ten");
  assert(state.votes[1][0] === base + 4000 && state.votes[3][0] === base + 6000, "catch-up samples must retain their scheduled timestamps");
  keyReleased();
  updateInputSampling(base + 7000);
  assert(derived.total === 4, "releasing an arrow must stop further held samples");

  setTestClock(base + 7100);
  keyCode = LEFT_ARROW;
  keyPressed({ repeat: false });
  setTestClock(base + 7200);
  keyReleased();
  keyCode = RIGHT_ARROW;
  keyPressed({ repeat: false });
  setTestClock(base + 7300);
  keyReleased();
  setTestClock(base + 8000);
  updateInputSampling();
  assert(derived.total === 6 && derived.yes === 2 && derived.no === 4, "YES and NO taps before the next sample must both count");
  const simultaneousGroup = derived.days[0].groups.find((group) => group.second === Math.floor((base - campaignStartMs) / 1000) + 8);
  assert(simultaneousGroup.events.length === 2 && simultaneousGroup.bars.length === 2, "concurrent YES and NO must share one second with separate aggregate bars");

  keyCode = LEFT_ARROW;
  keyPressed({ repeat: false });
  keyCode = RIGHT_ARROW;
  keyPressed({ repeat: false });
  assert(heldDirections.has(YES) && heldDirections.has(NO), "both arrow directions must be allowed to remain held simultaneously");
  keyCode = LEFT_ARROW;
  keyReleased();
  assert(heldDirections.size === 1 && heldDirections.has(NO), "releasing one arrow must not cancel the other held direction");
  resetInputSampling(base + 8000);
  updateInputSampling(base + 12000);
  assert(derived.total === 6 && pendingVotes.length === 0 && heldDirections.size === 0, "focus loss must clear all queued and held input and prevent phantom votes");

  state = createEmptyState();
  rebuildDerived();
  setTestClock(base);
  resetInputSampling();
  keyCode = LEFT_ARROW;
  for (let tap = 0; tap < 3; tap++) {
    setTestClock(base + 100 + tap * 100);
    keyPressed({ repeat: false });
    keyReleased();
  }
  keyCode = RIGHT_ARROW;
  setTestClock(base + 450);
  keyPressed({ repeat: false });
  keyReleased();
  assert(pendingVotes.length === 4 && derived.total === 0, "every rapid physical press must queue without overwriting earlier presses");
  setTestClock(base + 1000);
  updateInputSampling();
  assert(derived.yes === 3 && derived.no === 1 && derived.total === 4, "three rapid YES presses plus one NO must all count in the next sample");
  const burstGroup = derived.days[0].groups[0];
  assert(burstGroup.events.length === 4 && burstGroup.bars[0].count === 3 && burstGroup.bars[1].count === 1, "the burst must aggregate counts without dropping responses");
  assert(state.votes.every((vote) => vote[0] === base + 1000), "all concurrent responses must share the scheduled sample timestamp");
  assert(derived.days[0].finalValue === 10, "concurrent responses must all contribute to the cumulative net value");
  updateInputSampling(base + 2000);
  assert(derived.total === 4 && pendingVotes.length === 0, "queued taps must be consumed exactly once");
  saveState();
  state = loadState();
  rebuildDerived();
  assert(derived.yes === 3 && derived.no === 1, "all responses sharing a timestamp must survive persistence");

  state = createEmptyState();
  rebuildDerived();
  setTestClock(base);
  resetInputSampling();
  keyCode = LEFT_ARROW;
  keyPressed({ repeat: false });
  keyCode = RIGHT_ARROW;
  keyPressed({ repeat: false });
  setTestClock(base + 1000);
  updateInputSampling();
  assert(derived.yes === 1 && derived.no === 1, "fresh simultaneous held presses must not be counted twice on their first sample");
  setTestClock(base + 3000);
  updateInputSampling();
  assert(derived.yes === 3 && derived.no === 3, "both held arrows must each record one response per second, including catch-up samples");
  assert(derived.days[0].finalValue === 0, "simultaneous opposite directions must balance without losing either response");
  keyCode = LEFT_ARROW;
  keyReleased();
  setTestClock(base + 4000);
  updateInputSampling();
  assert(derived.yes === 3 && derived.no === 4, "releasing YES must stop only YES while NO keeps sampling");
  keyCode = RIGHT_ARROW;
  keyReleased();
  updateInputSampling(base + 5000);
  assert(derived.total === 7, "releasing both arrows must stop all held responses");

  state = createEmptyState();
  rebuildDerived();
  setTestClock(base);
  resetInputSampling();
  keyCode = LEFT_ARROW;
  keyPressed({ repeat: false });
  setTestClock(base + 1000);
  updateInputSampling();
  setTestClock(base + 1100);
  keyCode = RIGHT_ARROW;
  keyPressed({ repeat: false });
  keyReleased();
  setTestClock(base + 2000);
  updateInputSampling();
  assert(derived.yes === 2 && derived.no === 1, "a queued opposite tap must not suppress an already held direction");
  resetInputSampling();

  state = createEmptyState();
  rebuildDerived();
  resetInputSampling(base);
  queueDirection(YES, base + 2100);
  assert(derived.total === 0, "a new direction must not be applied retroactively to elapsed idle seconds");
  updateInputSampling(base + 3000);
  assert(derived.yes === 1, "the new direction must be consumed by the next scheduled sample");

  state = createEmptyState();
  rebuildDerived();
  const firstClose = campaignStartMs + CONFIG.CLOSE_HOUR * 3600000;
  resetInputSampling(firstClose - 100);
  queueDirection(YES, lastSampleClock);
  updateInputSampling(firstClose);
  assert(derived.total === 0 && heldDirections.size === 0 && pendingVotes.length === 0, "closing must immediately clear input even before the next sampling tick");
  resetInputSampling(firstClose - 1500);
  queueDirection(YES, lastSampleClock);
  updateInputSampling(firstClose + 500);
  assert(derived.days[0].finalValue === 5 && heldDirections.size === 0 && pendingVotes.length === 0, "only the sample before 18:00 may count; closing must clear held and queued arrows");
  assert(!queueDirection(NO, firstClose), "new arrows must be rejected at exactly 18:00");
  const secondOpen = campaignStartMs + CONFIG.DAY_MS + CONFIG.OPEN_HOUR * 3600000;
  assert(!queueDirection(YES, secondOpen - 1), "new arrows must be rejected just before 09:00");
  updateInputSampling(secondOpen + 1000);
  assert(derived.days[1].total === 0 && derived.total === 1, "an overnight hold must not create votes on the next day");
  assert(queueDirection(NO, secondOpen + 1100), "a new press must be accepted after reopening");
  updateInputSampling(secondOpen + 2000);
  assert(derived.days[1].startValue === 5 && derived.days[1].finalValue === 0 && derived.days[1].no === 1 && derived.total === 2, "the next day must continue yesterday's balance while counting its new press on that day only");
  resetInputSampling(secondOpen + 2000);

  // A suspended frame can catch up only valid samples and must clear the hold
  // even when the existing 240-sample responsiveness cap is reached.
  resetInputSampling(firstClose - 3600000);
  queueDirection(YES, lastSampleClock);
  updateInputSampling(firstClose + 1000);
  assert(heldDirections.size === 0 && pendingVotes.length === 0 && lastSampleClock === firstClose + 1000, "closing must clear stale input even after a long capped catch-up");

  state = createEmptyState();
  rebuildDerived();
  const finalClose = campaignEndMs - CONFIG.DAY_MS + CONFIG.CLOSE_HOUR * 3600000;
  resetInputSampling(finalClose - 1500);
  queueDirection(NO, lastSampleClock);
  updateInputSampling(finalClose + 500);
  assert(derived.no === 1 && heldDirections.size === 0, "only samples before the campaign end may record votes");
  queueDirection(YES, campaignEndMs + 1000);
  assert(pendingVotes.length === 0, "arrows must not queue votes after the campaign has closed");

  base = graphBase;
  const longUp = buildDayData(Array.from({ length: 2000 }, (_, i) => [base + i * 1000, YES]), 0);
  const longDown = buildDayData(Array.from({ length: 2000 }, (_, i) => [base + i * 1000, NO]), 0);
  assert(longUp.finalValue === 10000 && longDown.finalValue === -10000, "cumulative up/down values must not be clamped");
  const layout = { graph: { x: 499, y: 322, w: 1326, h: 363 }, sy: 1, ui: 1 };
  const baseline = layout.graph.y + layout.graph.h * 0.5;
  assert(CONFIG.BASE_VOTE_HEIGHT === 17, "the base vote height must be 17 pixels");
  const baseScale = graphVerticalScale(layout, day, baseline);
  assert(baseScale === CONFIG.BASE_VOTE_HEIGHT / CONFIG.STEP_Y, "small cumulative values must render at the configured base vote height");
  assert(voteBandBounds(0, CONFIG.STEP_Y, baseline, baseScale, layout.ui).h === 17, "one uncompressed vote must be exactly 17 pixels high");
  for (const history of [longUp, longDown]) {
    const scale = graphVerticalScale(layout, history, baseline);
    assert(scale > 0 && scale < 1, "large historical extrema must shrink the rendering scale");
    assert(baseline - history.maxValue * scale >= layout.graph.y + 18, "UP history must fit below the graph's top padding");
    assert(baseline - history.minValue * scale <= layout.graph.y + layout.graph.h - 6, "DOWN history must fit above the graph's bottom padding");
  }
  assert(graphVerticalScale(layout, longUp, baseline) === graphVerticalScale(layout, longDown, baseline), "equal UP and DOWN extrema must fit with the same scale around the centered zero");

  viewStartSecond = 0;
  timelineSecondWidth = CONFIG.SECOND_WIDTH;
  drawingEvents.length = 0;
  drawVoteTrace(layout, { liveSecond: 12 }, day, 12, baseline, 1);
  const drawnYes = drawingEvents.find((event) => event.type === "rect" && event.args[0] === layout.graph.x + 10 * CONFIG.SECOND_WIDTH);
  const drawnNo = drawingEvents.find((event) => event.type === "rect" && event.args[0] === layout.graph.x + 10.5 * CONFIG.SECOND_WIDTH);
  assert(drawnYes.args[3] === 10 && drawnNo.args[3] === 5, "rendered bar heights must use five logical pixels per vote");
  assert(drawnYes.args[2] === drawnNo.args[2], "the existing equal-width YES/NO graph style must be retained");
  assert(drawingEvents[0].args[3] === 31, "the existing idle-band thickness must remain unchanged at the initial scale");
  const pendingBand = drawingEvents.find((event) => event.type === "rect" && event.args[0] === layout.graph.x + 11 * CONFIG.SECOND_WIDTH);
  assert(pendingBand.args[1] === drawnNo.args[1] && pendingBand.args[3] === drawnNo.args[3], "pending must continue the last vote's exact top edge and height, not center on its endpoint");
  assert(!drawingEvents.some((event) => event.type === "circle"), "the live trace must not add a second cursor dot");
  drawingEvents.length = 0;
  drawGraphSecondStems(layout, { liveSecond: 12 }, day, 12, baseline, 1);
  const voteStem = drawingEvents.find((event) => event.type === "line" && event.args[0] === layout.graph.x + 10 * CONFIG.SECOND_WIDTH);
  assert(voteStem.args[1] === baseline - 5, "second stems must agree with the cumulative trace value");

  const pendingHistories = [
    [[base, YES]],
    [[base, NO]],
    [[base, YES], [base + 1, YES], [base + 2, YES]],
    [[base, NO], [base + 1, NO], [base + 2, NO], [base + 3, NO]],
    [[base, YES], [base + 1, YES], [base + 2, NO]],
    [[base, NO], [base + 1000, YES]],
    [[base, YES], [base + 1000, NO]]
  ];
  for (const votes of pendingHistories) {
    const history = buildDayData(votes, 0);
    for (const scale of [1, 0.25, 0.01]) {
      viewStartSecond = 0;
      drawingEvents.length = 0;
      drawVoteTrace(layout, { liveSecond: 20 }, history, 20, baseline, scale);
      const rectangles = drawingEvents.filter((event) => event.type === "rect");
      const lastVoteRect = rectangles[rectangles.length - 2];
      const lastPendingRect = rectangles[rectangles.length - 1];
      assert(lastVoteRect.args[1] === lastPendingRect.args[1], "YES/NO pending must align with the last vote's top edge at every vertical scale");
      assert(lastVoteRect.args[3] === lastPendingRect.args[3], "YES/NO pending must inherit the aggregate count and minimum rendered height");

      viewStartSecond = 19;
      drawingEvents.length = 0;
      drawVoteTrace(layout, { liveSecond: 20 }, history, 20, baseline, scale);
      const scrolledPending = drawingEvents.find((event) => event.type === "rect");
      assert(scrolledPending.args[1] === lastVoteRect.args[1] && scrolledPending.args[3] === lastVoteRect.args[3], "pending must retain the last vote's bounds when that vote is outside the viewport");

      viewStartSecond = history.groups[history.groups.length - 1].second + 0.75;
      drawingEvents.length = 0;
      drawVoteTrace(layout, { liveSecond: 20 }, history, 20, baseline, scale);
      const clippedRectangles = drawingEvents.filter((event) => event.type === "rect");
      const clippedPending = clippedRectangles[clippedRectangles.length - 1];
      assert(clippedPending.args[1] === lastVoteRect.args[1] && clippedPending.args[3] === lastVoteRect.args[3], "partially clipped and mixed-choice buckets must preserve the last vote's pending geometry");
    }
  }
  viewStartSecond = 0;
  drawingEvents.length = 0;
  const gapHistory = buildDayData([[base, YES], [base + 1, YES], [base + 2, YES], [base + 2000, NO]], 0);
  drawVoteTrace(layout, { liveSecond: 20 }, gapHistory, 20, baseline, 1);
  const earlierPending = drawingEvents.find((event) => event.type === "rect" && event.args[0] === layout.graph.x + 11 * CONFIG.SECOND_WIDTH);
  assert(earlierPending.args[1] === baseline - 15 && earlierPending.args[3] === 15, "an intermediate pending gap must inherit the previous three-vote YES bar's bounds");

  // Daily windows share one cumulative zero, including idle days and reloads.
  for (const choice of [YES, NO]) {
    state = createEmptyState();
    const opening = campaignStartMs + CONFIG.OPEN_HOUR * 3600000;
    state.votes = [
      [opening, choice], [opening + 1, choice], [opening + 2, choice],
      [opening + 1000, -choice],
      [opening + 2 * CONFIG.DAY_MS + 1000, -choice],
    ];
    rebuildDerived();
    const ending = 2 * choice * CONFIG.STEP_Y;
    assert(derived.days[0].startValue === 0 && derived.days[0].finalValue === ending, "only the first day begins at campaign zero");
    assert(derived.days[1].total === 0 && derived.days[1].startValue === ending && derived.days[1].finalValue === ending, "an empty day must retain the previous day's balance without adding votes");
    assert(derived.days[2].groups[0].startValue === ending && derived.days[2].finalValue === choice * CONFIG.STEP_Y, "the next vote must advance from the inherited positive or negative balance");
    assert(derived.days[6].startValue === choice * CONFIG.STEP_Y, "the balance must carry through every remaining empty day");

    viewStartSecond = CONFIG.OPEN_HOUR * 3600;
    timelineSecondWidth = CONFIG.SECOND_WIDTH;
    const scale = graphVerticalScale(layout, derived.days[1], baseline);
    drawingEvents.length = 0;
    drawVoteTrace(layout, { liveSecond: viewStartSecond + 1 }, derived.days[1], viewStartSecond + 1, baseline, scale);
    const carriedBand = drawingEvents.find((event) => event.type === "rect");
    const expectedBand = voteBandBounds(derived.days[0].finalVoteStartValue, ending, baseline, scale, layout.ui);
    assert(carriedBand.args[1] === expectedBand.y && carriedBand.args[3] === expectedBand.h, "the overnight idle band must retain the previous vote's exact bounds");
    assert(!drawingEvents.some((event) => event.type === "circle"), "an empty day must not add a second cursor dot");
    drawingEvents.length = 0;
    drawGraphSecondStems(layout, { liveSecond: viewStartSecond + 2 }, derived.days[2], viewStartSecond + 2, baseline, scale);
    assert(drawingEvents[0].args[1] === baseline - ending * scale, "stems before the new day's first vote must start at the inherited balance");
    drawingEvents.length = 0;
    drawVoteTrace(layout, { liveSecond: viewStartSecond + 2 }, derived.days[2], viewStartSecond + 2, baseline, scale);
    const nextBar = drawingEvents.find((event) => event.type === "rect" && event.args[0] === layout.graph.x + CONFIG.SECOND_WIDTH);
    const expectedNextBar = voteBandBounds(ending, choice * CONFIG.STEP_Y, baseline, scale, layout.ui);
    assert(nextBar.args[1] === expectedNextBar.y && nextBar.args[3] === expectedNextBar.h, "the first new-day bar must render from yesterday's balance");

    saveState();
    state = loadState();
    rebuildDerived();
    assert(derived.days[1].startValue === ending && derived.days[2].finalValue === choice * CONFIG.STEP_Y, "reloading saved votes must reconstruct the same balance across days");
  }
  const compressedPreviousDay = buildDayData([
    ...Array.from({ length: 100 }, (_, i) => [graphBase + i, YES]),
    ...Array.from({ length: 98 }, (_, i) => [graphBase + 1000 + i, NO]),
  ], 0);
  const compressedNewDay = buildDayData([], 1, compressedPreviousDay);
  assert(compressedNewDay.startValue === 10 && graphVerticalScale(layout, compressedNewDay, baseline) === graphVerticalScale(layout, compressedPreviousDay, baseline), "a new day must retain the previous vertical scale even when the ending balance is smaller than earlier peaks");
  viewStartSecond = 0;

  assert(!getCampaignTiming(campaignStartMs - 1).active, "pre-campaign voting must be closed");
  assert(!getCampaignTiming(campaignStartMs).active, "midnight must not open voting");
  for (let dayIndex = 0; dayIndex < CONFIG.CAMPAIGN_DAYS; dayIndex++) {
    const dayStart = campaignStartMs + dayIndex * CONFIG.DAY_MS;
    const opening = dayStart + 9 * 3600000;
    const closing = dayStart + 18 * 3600000;
    const waiting = getCampaignTiming(opening - 1);
    assert(waiting.phase === (dayIndex === 0 ? "before-event" : "before-day"), "the neutral first opening and blurred later openings must be different states");
    assert(getGraphTiming(waiting).displayDayIndex === Math.max(0, dayIndex - 1), "later mornings must retain the previous completed day, never show an empty current-day graph");
    assert(waiting.preOpening && !waiting.active && waiting.nextOpenMs === opening && waiting.displayDayIndex === dayIndex, "each day must wait until 09:00 and keep the correct calendar date");
    assert(getCampaignTiming(opening).active && getCampaignTiming(opening).activeDayIndex === dayIndex, "each day must open at exactly 09:00 Vietnam time");
    assert(getGraphTiming(getCampaignTiming(opening)).historyStartSecond === CONFIG.OPEN_HOUR * 3600, "an active day''s fit-all graph must start at opening, never midnight");
    assert(getCampaignTiming(closing - 1).active, "each day must stay open up to 17:59:59.999");
    const closed = getCampaignTiming(closing);
    assert(closed.phase === "after-day" && getGraphTiming(closed).displayDayIndex === dayIndex, "each closing must keep its completed day under the thank-you screen");
    assert(!closed.active && closed.liveSecond === 18 * 3600, "each day must close and stop the daily live edge at exactly 18:00");
    assert(closed.complete === (dayIndex === 6), "only the final 18:00 closing must complete the campaign");
    assert(closed.nextOpenMs === (dayIndex === 6 ? null : opening + CONFIG.DAY_MS), "after closing the next opening must be tomorrow, never outside the week");
  }
  assert(getCampaignTiming(new Date("2026-09-16T02:00:00Z").getTime()).active, "09:00 Vietnam is 02:00 UTC regardless of the browser timezone");
  assert(!getCampaignTiming(new Date("2026-09-16T11:00:00Z").getTime()).active, "18:00 Vietnam is 11:00 UTC regardless of the browser timezone");
  assert(getCampaignTiming(campaignEndMs).complete, "campaign must freeze at the seven-day boundary");

  fitAll = true;
  const fittedWidth = secondWidthForView({ w: 1326 }, { liveSecond: 3600 });
  assert(Math.abs(fittedWidth - 1326 / 3600) < 1e-9, "fit-all must map all elapsed seconds into the graph width");
  assert(timelineTickStep(fittedWidth) >= 300, "fit-all timestamps must thin out for readability");
  fitAll = false;
  assert(secondWidthForView({ w: 1326 }, { liveSecond: 3600 }) === CONFIG.SECOND_WIDTH, "live view must restore fixed second spacing");
  zoomSecondWidth = CONFIG.SECOND_WIDTH * 2;
  assert(secondWidthForView({ w: 1326 }, { liveSecond: 3600 }) === 56, "manual zoom must control the live-view scale");
  zoomSecondWidth = CONFIG.SECOND_WIDTH;

  state = createEmptyState();
  state.votes = [[base, YES], [base + 1, NO]];
  saveState();
  state = loadState();
  assert(state.votes.length === 2, "valid local votes must survive save and restore");
  rebuildDerived();
  assert(derived.days[0].finalValue === 0, "restored YES/NO samples must reconstruct the cumulative value");

  state.prompts = createEmptyState().prompts;
  for (let index = 0; index < 6; index++) appendPrompt(base + index);
  assert(state.prompts.visible.length === 5, "the Figma prompt feed must retain five items");
  assert(state.prompts.visible[0][0] === 1, "the sixth prompt must remove the oldest item");
  assert(state.prompts.visible[4][0] === 5, "the sixth prompt must occupy the fifth row");

  derived = { yes: 2, no: 1 };
  assert(panelColorForTotals() === CONFIG.YES_COLOR, "YES majority must color the overview turquoise");
  derived = { yes: 1, no: 2 };
  assert(panelColorForTotals() === CONFIG.NO_COLOR, "NO majority must color the overview orange");
  derived = { yes: 2, no: 2 };
  state.lastLeader = NO;
  assert(panelColorForTotals() === CONFIG.NO_COLOR, "a tie must retain the last leader");
  state.lastLeader = 0;
  derived = { yes: 0, no: 0 };
  assert(panelColorForTotals() === "#F3F3F3", "a fresh zero-response campaign must use neutral white");
  assert(formatOpeningCountdown(42 * 60000 + 18000) === "00 : 42 : 18", "the countdown must match the Figma spacing and precision");
  assert(formatOpeningCountdown(1) === "00 : 00 : 01" && formatOpeningCountdown(-1) === "00 : 00 : 00", "the countdown must never show negative or premature zero seconds");

  console.log("Collective Pulse logic checks passed.");
`;

vm.runInContext(checks, context);

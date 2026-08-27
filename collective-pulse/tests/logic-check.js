const fs = require("fs");
const path = require("path");
const vm = require("vm");

const memory = {};
const context = {
  console,
  Math,
  Date,
  Intl,
  Object,
  Array,
  Number,
  JSON,
  String,
  localStorage: {
    getItem: (key) => memory[key] ?? null,
    setItem: (key, value) => { memory[key] = value; },
    removeItem: (key) => { delete memory[key]; },
    key: (index) => Object.keys(memory)[index] ?? null,
    get length() { return Object.keys(memory).length; }
  },
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  pow: Math.pow,
  constrain: (value, low, high) => Math.min(high, Math.max(low, value)),
  millis: () => 0
};

vm.createContext(context);

const sketchPath = path.join(__dirname, "..", "sketch.js");
const sketch = fs.readFileSync(sketchPath, "utf8");
const checks = `
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  campaignStartMs = new Date(
    CONFIG.CAMPAIGN_START_DATE + "T00:00:00" + CONFIG.CAMPAIGN_TIMEZONE_OFFSET
  ).getTime();
  campaignEndMs = campaignStartMs + CONFIG.CAMPAIGN_DAYS * CONFIG.DAY_MS;

  const base = campaignStartMs + 10000;
  const seeded = createInitialState();
  assert(seeded.votes.length === 204, "the preview must seed 204 yesterday votes");
  assert(
    seeded.votes.every((vote) => vote[0] >= campaignStartMs && vote[0] < campaignStartMs + CONFIG.DAY_MS),
    "every preview vote must belong to yesterday"
  );
  const seededDay = buildDayData(seeded.votes, 0);
  assert(seededDay.groups[0].bars[0].count === 3, "the first seed bucket must show a three-vote YES bar");
  assert(seededDay.groups[0].bars[1].count === 1, "the first seed bucket must show a one-vote NO bar");

  localStorage.setItem("collective_pulse_v1:old", "legacy");
  localStorage.setItem(storageKey(), "current");
  clearLegacyCampaignStorage();
  assert(localStorage.getItem("collective_pulse_v1:old") === null, "legacy campaign data must be cleared");
  assert(localStorage.getItem(storageKey()) === "current", "the active campaign namespace must be retained");

  const day = buildDayData([
    [base, YES],
    [base + 10, YES],
    [base + 20, NO]
  ], 0);

  assert(day.groups.length === 1, "votes in one second must share one group");
  assert(day.groups[0].events.length === 3, "the second must retain all three votes");
  assert(day.finalValue === 1, "two YES and one NO must finish one step above zero");

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

  assert(!getCampaignTiming(campaignStartMs - 1).active, "pre-campaign voting must be closed");
  assert(getCampaignTiming(campaignStartMs).activeDayIndex === 0, "campaign must open on day one");
  assert(
    getCampaignTiming(campaignStartMs + CONFIG.DAY_MS).activeDayIndex === 1,
    "the second calendar day must use day index one"
  );
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

  state.prompts = createEmptyState().prompts;
  for (let index = 0; index < 5; index++) appendPrompt(base + index);
  assert(state.prompts.visible.length === 4, "prompt feed must retain four items");
  assert(state.prompts.visible[0][0] === 1, "the fifth prompt must remove the oldest item");
  assert(state.prompts.visible[3][0] === 4, "the fifth prompt must occupy the fourth row");

  derived = { yes: 2, no: 1 };
  assert(panelColorForTotals() === CONFIG.YES_COLOR, "YES majority must color the overview turquoise");
  derived = { yes: 1, no: 2 };
  assert(panelColorForTotals() === CONFIG.NO_COLOR, "NO majority must color the overview orange");
  derived = { yes: 2, no: 2 };
  state.lastLeader = NO;
  assert(panelColorForTotals() === CONFIG.NO_COLOR, "a tie must retain the last leader");

  console.log("Collective Pulse logic checks passed.");
`;

vm.runInContext(sketch + checks, context);

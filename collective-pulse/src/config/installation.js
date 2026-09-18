import { INSTALLATION_WEEK } from "./week.js";
// COLLECTIVE PULSE
// Seven-day, single-kiosk voting installation.
//
// INPUT CONTRACT (also compatible with a Makey Makey):
//   LEFT ARROW  -> YES -> up by 5 logical pixels per second
//   RIGHT ARROW -> NO  -> down by 5 logical pixels per second
//   Every tap is captured by the next sample, including simultaneous choices.
//   Each held arrow continues independently every second.

export const CONFIG = Object.freeze({
  // Voting and the calendar share the start date in week.js.
  CAMPAIGN_START_DATE: INSTALLATION_WEEK.START_DATE,
  CAMPAIGN_TIMEZONE_OFFSET: "+07:00",
  CAMPAIGN_DAYS: INSTALLATION_WEEK.DAYS,
  OPEN_HOUR: 9,
  CLOSE_HOUR: 18,
  SEED_DEMO_DATA: false,
  YES_COLOR: "#06FFCD",
  NO_COLOR: "#FF6D05",
  // Used before the first vote. During later ties, the last leader is retained.
  TIE_PANEL_COLOR: "#F3F3F3",
  NEUTRAL_PANEL_COLOR: "#F3F3F3",
  PROMPT_INTERVAL_MS: 5 * 60 * 1000,
  MAX_VISIBLE_PROMPTS: 5,
  VOTE_RIPPLE_MS: 2400,
  VOTE_RIPPLE_MAX_RADIUS: 588,
  DAY_MS: 24 * 60 * 60 * 1000,
  DAY_SECONDS: 24 * 60 * 60,
  INPUT_SAMPLE_MS: 1000,
  STEP_Y: 5,
  BASE_VOTE_HEIGHT: 17,
  SECOND_WIDTH: 28,
  MAX_SECOND_WIDTH: 224,
  ZOOM_FACTOR: 1.5,
  // Legacy storage versions are removed. Date-keyed v4 sessions are kept
  // across reloads and when switching between testing and the event week.
  STORAGE_KEY: "collective_pulse_v4",
  STORAGE_NAMESPACE: "collective_pulse_",
});

// Defaults work with static hosting; the local service manages the live queue.
export const STATE_VERSION = 2;
export const YES = 1;
export const NO = -1;

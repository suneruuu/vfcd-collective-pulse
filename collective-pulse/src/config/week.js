// Production week. Tests inject their own start date through the module loader.
export const INSTALLATION_WEEK = Object.freeze({
  START_DATE: (import.meta.env || {}).VITE_CAMPAIGN_START_DATE || "2026-09-21",
  DAYS: 7,
});

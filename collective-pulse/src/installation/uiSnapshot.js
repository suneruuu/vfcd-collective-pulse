import { CONFIG } from "../config/installation.js";
export function getUiSnapshot(runtime, timing, now, layout, formatting) {
  return {
    now: Math.floor(now / 1000) * 1000,
    phase: timing.phase,
    before: timing.before,
    active: timing.active,
    informationPanelVisible: runtime.informationPanelVisible,
    navigationHelperVisible: runtime.navigationHelperVisible,
    followLive: runtime.selectedOverviewDay === null && !runtime.fitAll && runtime.followLive,
    fitAll: runtime.fitAll,
    selectedOverviewDay: runtime.selectedOverviewDay,
    pulsePreview: runtime.pulsePreview,
    mainWidth: layout.mainW,
    timedScreen: runtime.timedScreen,
    status: runtime.status,
    dayLabels: Array.from(
      {
        length: CONFIG.CAMPAIGN_DAYS,
      },
      (_, day) =>
        "View D" +
        (day + 1) +
        ", " +
        formatting.formatDate(runtime.campaignStartMs + day * CONFIG.DAY_MS) +
        " graph",
    ),
  };
}

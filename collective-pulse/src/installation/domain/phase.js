import { CONFIG } from "../../config/installation.js";
export function createPhase(runtime, { formatting }) {
  function updateTimedScreen(layout, timing, now) {
    const key = `${timing.phase}:${timing.displayDayIndex}`;
    if (key !== runtime.timedStateKey) {
      runtime.timedStateKey = key;
      runtime.selectedOverviewDay = null;
      runtime.pulsePreview = false;
      runtime.dragState = null;
      if (!timing.active && !timing.before) {
        if (!runtime.openViewState)
          runtime.openViewState = {
            fitAll: runtime.fitAll,
            followLive: runtime.followLive,
            zoomSecondWidth: runtime.zoomSecondWidth,
          };
        runtime.fitAll = true;
        runtime.followLive = false;
      } else if (timing.active && runtime.openViewState) {
        ({
          fitAll: runtime.fitAll,
          followLive: runtime.followLive,
          zoomSecondWidth: runtime.zoomSecondWidth,
        } = runtime.openViewState);
        runtime.openViewState = null;
      }
    }
    const closing = timing.phase === "after-day";
    runtime.timedScreen = {
      hidden: timing.active,
      phase: timing.phase,
      preview: runtime.pulsePreview,
      mainWidth: layout.mainW,
      label: timing.before
        ? "COLLECTIVE PULSE STARTS IN"
        : closing
          ? "THANK YOU FOR PARTICIPATING"
          : "TODAY PULSE STARTS IN",
      value: closing
        ? timing.complete
          ? "COLLECTIVE PULSE COMPLETE"
          : "NEXT PULSE TOMORROW \u00b7 " + String(CONFIG.OPEN_HOUR).padStart(2, "0") + ":00"
        : formatting.formatOpeningCountdown(timing.nextOpenMs - now),
      buttonHidden: timing.before || timing.active,
    };
  }
  return {
    updateTimedScreen,
  };
}

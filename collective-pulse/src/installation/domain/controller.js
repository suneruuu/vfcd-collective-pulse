export function createController(runtime, { prompts }) {
  // -----------------------------------------------------------------------------
  // PROMPTS
  // -----------------------------------------------------------------------------

  function handleDayChange(timing, now) {
    if (timing.activeDayIndex === runtime.lastFrameDayIndex) return;
    runtime.lastFrameDayIndex = timing.activeDayIndex;
    if (runtime.selectedOverviewDay === null) {
      runtime.viewedDayIndex = timing.displayDayIndex;
      runtime.viewStartSecond = 0;
      runtime.followLive = !runtime.fitAll;
    }
    prompts.ensurePromptDay(timing, now);
  }
  return {
    handleDayChange,
  };
}

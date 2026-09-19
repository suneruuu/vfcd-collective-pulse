import { CONFIG } from "../../config/installation.js";
import { clamp } from "../../../shared/math.js";
export function createCamera(
  runtime,
  { announce, campaign, focusCanvas, formatting, phase, viewport, clock = Date },
) {
  function getGraphTiming(timing, now = clock.now()) {
    if (runtime.selectedOverviewDay !== null && !timing.before) {
      const dayIndex = runtime.selectedOverviewDay;
      const dayStart = runtime.campaignStartMs + dayIndex * CONFIG.DAY_MS;
      const firstSecond =
        runtime.derived.days[dayIndex].groups[0]?.second ?? CONFIG.OPEN_HOUR * 3600;
      return {
        ...timing,
        active: timing.active && dayIndex === timing.activeDayIndex,
        displayDayIndex: dayIndex,
        displayDayStart: dayStart,
        liveSecond: clamp(
          (now - dayStart) / 1000,
          CONFIG.OPEN_HOUR * 3600,
          CONFIG.CLOSE_HOUR * 3600,
        ),
        historyStartSecond: Math.min(CONFIG.OPEN_HOUR * 3600, firstSecond),
      };
    }
    if (timing.before) return timing;
    if (timing.active)
      return {
        ...timing,
        historyStartSecond: CONFIG.OPEN_HOUR * 3600,
      };
    // Later mornings retain the previous day's completed pulse behind the blur.
    const dayIndex =
      timing.phase === "before-day" ? timing.displayDayIndex - 1 : timing.displayDayIndex;
    const firstSecond = runtime.derived.days[dayIndex].groups[0]?.second ?? CONFIG.OPEN_HOUR * 3600;
    return {
      ...timing,
      displayDayIndex: dayIndex,
      displayDayStart: runtime.campaignStartMs + dayIndex * CONFIG.DAY_MS,
      liveSecond: CONFIG.CLOSE_HOUR * 3600,
      historyStartSecond: Math.min(CONFIG.OPEN_HOUR * 3600, firstSecond),
    };
  }
  function overviewDayAtPoint(layout, x, y, timing = campaign.getCampaignTiming(clock.now())) {
    if (!runtime.informationPanelVisible || timing.before) return null;
    const target = {
      x: layout.overview.x,
      y: 874 * layout.sy,
      w: layout.overview.w,
      h: 168 * layout.sy,
    };
    if (!viewport.pointInRect(x, y, target)) return null;
    return Math.min(
      CONFIG.CAMPAIGN_DAYS - 1,
      Math.floor(((x - target.x) / target.w) * CONFIG.CAMPAIGN_DAYS + 1e-9),
    );
  }
  function selectOverviewDay(dayIndex, now = clock.now()) {
    if (
      !runtime.informationPanelVisible ||
      !Number.isInteger(dayIndex) ||
      dayIndex < 0 ||
      dayIndex >= CONFIG.CAMPAIGN_DAYS
    )
      return false;
    const timing = campaign.getCampaignTiming(now);
    if (timing.before) return false;
    // Synchronize a just-changed phase before setting the new selection, so the
    // next frame does not immediately clear a click at an opening/closing edge.
    phase.updateTimedScreen(viewport.getLayout(), timing, now);
    runtime.selectedOverviewDay = dayIndex;
    if (!timing.active) runtime.pulsePreview = true;
    runtime.fitAll = true;
    runtime.followLive = false;
    runtime.dragState = null;
    runtime.viewedDayIndex = dayIndex;
    runtime.viewStartSecond = getGraphTiming(timing, now).historyStartSecond;
    announce(
      `Viewing D${dayIndex + 1}, ${formatting.formatDate(runtime.campaignStartMs + dayIndex * CONFIG.DAY_MS)}. Voting still follows today's opening hours.`,
    );
    focusCanvas();
    return true;
  }
  // -----------------------------------------------------------------------------
  // CAMERA / SCROLLING
  // -----------------------------------------------------------------------------

  function graphStartSecond(timing) {
    return timing.historyStartSecond ?? CONFIG.OPEN_HOUR * 3600;
  }
  function updateCamera(timing, graph) {
    const minimumStart = graphStartSecond(timing);
    if (runtime.viewedDayIndex !== timing.displayDayIndex) {
      runtime.viewedDayIndex = timing.displayDayIndex;
      runtime.viewStartSecond = minimumStart;
      runtime.followLive = !runtime.fitAll;
    }
    if (runtime.fitAll) {
      runtime.viewStartSecond = minimumStart;
      return;
    }
    const visibleSeconds = graph.w / viewport.secondWidthForView(graph, timing);
    if (runtime.followLive) {
      runtime.viewStartSecond = Math.max(minimumStart, timing.liveSecond - visibleSeconds);
    }
    runtime.viewStartSecond = constrainViewStart(runtime.viewStartSecond, timing, visibleSeconds);
  }
  function constrainViewStart(value, timing, suppliedVisibleSeconds = null) {
    const graph = viewport.getLayout().graph;
    const visibleSeconds =
      suppliedVisibleSeconds || graph.w / viewport.secondWidthForView(graph, timing);
    const minimumStart = graphStartSecond(timing);
    const availableEnd = timing.liveSecond;
    const maxStart = Math.max(minimumStart, availableEnd - visibleSeconds * 0.08);
    return clamp(value, minimumStart, maxStart);
  }

  // -----------------------------------------------------------------------------
  // PROMPTS / VOTE WATER-DROP BACKGROUND
  // -----------------------------------------------------------------------------

  function zoomTimeline(factor, layout, timing, anchorX = null) {
    const graph = layout.graph;
    const oldWidth = viewport.secondWidthForView(graph, timing);
    const minimumStart = graphStartSecond(timing);
    const oldStart = runtime.fitAll
      ? minimumStart
      : Math.max(minimumStart, runtime.viewStartSecond);
    const wasFollowingLive = !runtime.fitAll && runtime.followLive;
    const anchor = clamp(anchorX ?? graph.x + graph.w * 0.5, graph.x, graph.x + graph.w);
    const anchorSecond = oldStart + (anchor - graph.x) / oldWidth;
    const maximumWidth = CONFIG.MAX_SECOND_WIDTH * layout.ui;
    const minimumWidth = Math.min(
      maximumWidth,
      graph.w / Math.max(1, timing.liveSecond - minimumStart),
    );
    runtime.zoomSecondWidth = clamp(oldWidth * factor, minimumWidth, maximumWidth);
    runtime.fitAll = false;
    runtime.followLive = wasFollowingLive;
    if (runtime.followLive) {
      updateCamera(timing, graph);
      return;
    }
    runtime.viewStartSecond = constrainViewStart(
      anchorSecond - (anchor - graph.x) / runtime.zoomSecondWidth,
      timing,
      graph.w / runtime.zoomSecondWidth,
    );
  }
  function activateFitAll() {
    runtime.fitAll = true;
    runtime.followLive = false;
    runtime.viewStartSecond = 0;
  }
  function activateLiveView() {
    runtime.selectedOverviewDay = null;
    runtime.fitAll = false;
    runtime.followLive = true;
  }
  return {
    getGraphTiming,
    overviewDayAtPoint,
    selectOverviewDay,
    updateCamera,
    constrainViewStart,
    zoomTimeline,
    activateFitAll,
    activateLiveView,
  };
}

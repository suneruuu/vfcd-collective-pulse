import { CONFIG } from "../../config/installation.js";
export function createViewport(runtime, { p }) {
  // -----------------------------------------------------------------------------
  // LAYOUT
  // -----------------------------------------------------------------------------

  function getLayout() {
    const sx = p.width / 1920;
    const sy = p.height / 1080;
    const ui = Math.min(sx, sy);
    const mainW = (runtime.informationPanelVisible ? 1465 : 1920) * sx;
    const graph = {
      x: 53 * sx,
      y: 285 * sy,
      w: mainW - 94 * sx,
      h: 514 * sy,
      stemBottom: 776 * sy,
      timestampY: 785 * sy,
    };
    return {
      sx,
      sy,
      ui,
      mainW,
      information: {
        x: 1465 * sx,
        y: 430 * sy,
        w: 455 * sx,
        h: 650 * sy,
      },
      overview: {
        x: 1498 * sx,
        y: 838 * sy,
        w: 389 * sx,
        h: 216 * sy,
        baseline: (874 + 137 / 2) * sy,
      },
      graph,
      prompt: {
        timestampX: 53 * sx,
        lineX: 138 * sx,
        questionX: 228 * sx,
        w: mainW - 281 * sx,
        rows: [827, 869, 906, 943, 980].map((y) => y * sy),
      },
    };
  }

  // -----------------------------------------------------------------------------
  // LOWER-RIGHT INFORMATION / OVERVIEW
  // -----------------------------------------------------------------------------

  function viewControlRects(layout) {
    const shiftX = runtime.informationPanelVisible ? 0 : 455;
    const box = (x, w) => ({
      x: (x + shiftX) * layout.sx,
      y: 26 * layout.sy,
      w: w * layout.sx,
      h: 33 * layout.sy,
    });
    return {
      zoomIn: box(1205, 33),
      zoomOut: box(1237, 34),
      live: box(1281, 67),
      fitAll: box(1358, 67),
    };
  }
  function xForSecond(second, graph) {
    return graph.x + (second - runtime.viewStartSecond) * runtime.timelineSecondWidth;
  }
  function secondWidthForView(graph, timing) {
    if (!runtime.fitAll) return runtime.zoomSecondWidth;
    return graph.w / Math.max(1, timing.liveSecond - (timing.historyStartSecond ?? 0));
  }
  function timelineTickStep(secondWidth, minimumSpacing = 72) {
    const targetSeconds = minimumSpacing / Math.max(secondWidth, 0.0001);
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
  return {
    getLayout,
    viewControlRects,
    xForSecond,
    secondWidthForView,
    timelineTickStep,
    lowerBoundGroup,
    pointInRect,
  };
}

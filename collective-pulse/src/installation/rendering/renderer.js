import { CONFIG, YES, NO } from "../../config/installation.js";
import { clamp } from "../../../shared/math.js";
import { assetUrl } from "../../services/paths.js";
export function createRenderer(
  runtime,
  { campaign, formatting, p, viewport, voting, clock = Date },
) {
  function preload() {
    const assetFiles = {
      axis: "axis.svg",
      liveCursor: "live-cursor.svg",
      overviewCursor: "overview-cursor.svg",
      overviewDayRule: "overview-day-rule.svg",
      overviewBaseline: "overview-baseline.svg",
      panelRule: "panel-rule.svg",
      prompt40: "prompt-40.svg",
      prompt50: "prompt-50.svg",
      prompt60: "prompt-60.svg",
      prompt100: "prompt-100.svg",
    };
    for (const [name, filename] of Object.entries(assetFiles)) {
      runtime.designAssets[name] = p.loadImage(assetUrl(filename));
    }
  }
  // -----------------------------------------------------------------------------
  // LOWER-RIGHT INFORMATION / OVERVIEW
  // -----------------------------------------------------------------------------

  function drawInformationPanel(layout, timing, now) {
    if (!runtime.informationPanelVisible) return;
    const panel = layout.information;
    p.noStroke();
    p.fill(timing.before ? CONFIG.NEUTRAL_PANEL_COLOR : runtime.panelColor);
    p.rect(panel.x, panel.y, panel.w, timing.active ? panel.h : 672 * layout.sy);
    const x = 1498 * layout.sx;
    const contentW = 389 * layout.sx;
    const ui = layout.ui;
    p.fill(0);
    p.textAlign(p.LEFT, p.TOP);
    p.textStyle(p.BOLD);
    p.textSize(20 * ui);
    p.text("COLLECTIVE PULSE", x, 446 * layout.sy);
    p.textStyle(p.NORMAL);
    p.textSize(20 * ui);
    p.textLeading(27 * ui);
    p.textWrap(p.WORD);
    p.text(
      "Vietnam's creative community is growing rapidly. Collective Pulse installation asks what kind of future we want to build for design in Vietnam.",
      x,
      485 * layout.sy,
      contentW,
      115 * layout.sy,
    );
    p.text(
      "Come & make your choice. Your response becomes part of the collective dataset.",
      x,
      606 * layout.sy,
      contentW,
      60 * layout.sy,
    );
    drawPanelRule(layout, 677 * layout.sy);
    if (timing.before) return;
    p.textStyle(p.BOLD);
    p.textSize(20 * ui);
    p.text(
      `${runtime.derived.total.toLocaleString()} RESPONSES`,
      1502 * layout.sx,
      713 * layout.sy,
    );
    const yesPercent = runtime.derived.total
      ? Math.round((runtime.derived.yes / runtime.derived.total) * 100)
      : 0;
    const noPercent = runtime.derived.total ? 100 - yesPercent : 0;
    p.textAlign(p.LEFT, p.TOP);
    p.textStyle(p.NORMAL);
    p.textSize(20 * ui);
    p.text(`• YES ${yesPercent}%`, 1798 * layout.sx, 713 * layout.sy);
    p.text(`• NO ${noPercent}%`, 1798 * layout.sx, 740 * layout.sy);
    drawPanelRule(layout, 786 * layout.sy);
    p.textStyle(p.BOLD);
    p.textSize(20 * ui);
    p.text("OVERVIEW", 1502 * layout.sx, 808 * layout.sy);
    drawOverviewGraph(layout, timing, now);
    p.noStroke();
    p.fill(0);
    p.textStyle(p.BOLD);
    p.textSize(20 * ui);
    p.textAlign(p.RIGHT, p.TOP);
    p.text(formatting.formatCampaignElapsed(now), 1887 * layout.sx, 838 * layout.sy);
    p.textAlign(p.LEFT, p.TOP);
    p.textStyle(p.NORMAL);
  }
  function drawPanelRule(layout, y) {
    p.image(
      runtime.designAssets.panelRule,
      1498 * layout.sx,
      y - layout.sy,
      389 * layout.sx,
      layout.sy,
    );
  }
  function overviewXForTimestamp(timestamp, layout) {
    const { x, w } = layout.overview;
    const votingDuration = CONFIG.CAMPAIGN_DAYS * (CONFIG.CLOSE_HOUR - CONFIG.OPEN_HOUR) * 3600000;
    const progress = campaign.overviewElapsedMs(timestamp) / votingDuration;
    return x + progress * w;
  }
  function overviewVerticalScale(layout, history) {
    const baseline = layout.overview.baseline;
    // Keep a small number of votes proportional to the main graph instead of
    // stretching the first vote to fill the entire miniature chart.
    const baseScale = (CONFIG.BASE_VOTE_HEIGHT / CONFIG.STEP_Y) * layout.ui * (137 / 514);
    const maxAbs = Math.max(Math.abs(history.minValue), Math.abs(history.maxValue));
    if (maxAbs === 0) return baseScale;
    // Reserve equal room and padding for positive and negative balances.
    const availableHalfHeight =
      Math.min(baseline - 877 * layout.sy, 1008 * layout.sy - baseline) * 0.88;
    return Math.min(baseScale, availableHalfHeight / maxAbs);
  }
  function drawOverviewGraph(layout, timing, now = clock.now()) {
    const { x, w, baseline } = layout.overview;
    const plotTop = 874 * layout.sy;
    const plotHeight = 137 * layout.sy;
    const history = runtime.derived.overview;
    // All seven days remain visible, but each contains only its 09:00-18:00
    // voting window. The cursor does not consume chart space overnight.
    const visibleEnd = clamp(now, runtime.campaignStartMs, runtime.campaignEndMs);
    const cursorX = overviewXForTimestamp(visibleEnd, layout);
    const yScale = overviewVerticalScale(layout, history);

    // Exact reference decorations; the dashed dividers extend below the plot.
    for (let day = 1; day < CONFIG.CAMPAIGN_DAYS; day++) {
      const dayX = x + (day * w) / CONFIG.CAMPAIGN_DAYS;
      p.image(
        runtime.designAssets.overviewDayRule,
        dayX - 0.5 * layout.sx,
        plotTop,
        1.00001 * layout.sx,
        168 * layout.sy,
      );
    }
    p.image(runtime.designAssets.overviewBaseline, x, baseline - 0.5 * layout.sy, w, layout.sy);
    const ctx = p.drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, plotTop, w, plotHeight);
    ctx.clip();
    p.stroke(0);
    p.strokeWeight(2 * layout.ui);
    let previousX = x;
    let previousY = baseline;
    for (const point of history.points) {
      if (point.timestamp > visibleEnd) break;
      const pointX = overviewXForTimestamp(point.timestamp, layout);
      const pointY = baseline - point.value * yScale;
      // Idle time is horizontal; vote updates happen at their recorded second.
      if (pointX > previousX) p.line(previousX, previousY, pointX, previousY);
      if (pointY !== previousY) p.line(pointX, previousY, pointX, pointY);
      previousX = pointX;
      previousY = pointY;
    }
    if (cursorX > previousX) p.line(previousX, previousY, cursorX, previousY);
    ctx.restore();

    // Preserve the 137px cursor box and its exact 139.667×5.33333 exported leaf.
    // Draw outside the trace clip so its top dot is not cut in half.
    p.push();
    p.translate(cursorX, plotTop);
    p.rotate(p.HALF_PI);
    p.image(
      runtime.designAssets.overviewCursor,
      -2.66667 * layout.sy,
      -2.666665 * layout.sx,
      139.667 * layout.sy,
      5.33333 * layout.sx,
    );
    p.pop();
    p.textSize(20 * layout.ui);
    p.textStyle(p.BOLD);
    p.textAlign(p.LEFT, p.TOP);
    p.fill(0);
    p.noStroke();
    for (let day = 0; day < CONFIG.CAMPAIGN_DAYS; day++) {
      p.text(`D${day + 1}`, x + (day * w) / CONFIG.CAMPAIGN_DAYS, 1021 * layout.sy);
    }
    if (runtime.selectedOverviewDay !== null) {
      p.stroke(0);
      p.strokeWeight(2 * layout.ui);
      const selectedX = x + (runtime.selectedOverviewDay * w) / CONFIG.CAMPAIGN_DAYS;
      p.line(
        selectedX,
        1047 * layout.sy,
        selectedX + Math.min(24 * layout.ui, w / CONFIG.CAMPAIGN_DAYS),
        1047 * layout.sy,
      );
      p.noStroke();
    }
    p.textAlign(p.LEFT, p.TOP);
  }
  // -----------------------------------------------------------------------------
  // MAIN QUESTION / DAILY GRAPH
  // -----------------------------------------------------------------------------

  function drawMainHeader(layout) {
    const x = 53 * layout.sx;
    const ui = layout.ui;
    p.noStroke();
    p.fill(255);
    p.textAlign(p.LEFT, p.TOP);
    p.textStyle(p.NORMAL);
    p.textSize(84 * ui);
    p.textLeading(92.4 * ui);
    p.text("Does Vietnam need an\nannual Creative Festival?", x, 39 * layout.sy);
    if (runtime.storageFailed) {
      p.fill(CONFIG.NO_COLOR);
      p.textSize(14 * ui);
      p.textAlign(p.RIGHT, p.TOP);
      p.text("LOCAL SAVE ERROR", layout.mainW - 53 * layout.sx, 118 * layout.sy);
    }
    p.textAlign(p.LEFT, p.TOP);
    p.textStyle(p.NORMAL);
  }
  function drawVerticalAsset(asset, x, y, length, thickness, capOffset = 0) {
    p.push();
    p.translate(x, y);
    p.rotate(p.HALF_PI);
    p.image(asset, -capOffset, -thickness * 0.5, length + capOffset, thickness);
    p.pop();
  }
  function drawDailyGraph(layout, timing, now) {
    const graph = layout.graph;
    const dayData = runtime.derived.days[timing.displayDayIndex];
    runtime.timelineSecondWidth = viewport.secondWidthForView(graph, timing);
    const viewEnd = runtime.viewStartSecond + graph.w / runtime.timelineSecondWidth;
    const baseline = graph.y + graph.h * 0.5;
    const yScale = graphVerticalScale(layout, dayData, baseline);
    drawGraphAxes(layout, timing, dayData, baseline, viewEnd, yScale);
    const ctx = p.drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(graph.x, graph.y, graph.w, graph.h);
    ctx.clip();
    drawGraphSecondStems(layout, timing, dayData, viewEnd, baseline, yScale);
    drawVoteTrace(layout, timing, dayData, viewEnd, baseline, yScale);
    if (timing.active !== false) drawLiveCursor(layout, timing, baseline);
    ctx.restore();
    drawGraphTimestamps(layout, timing, dayData, viewEnd);
  }
  function graphVerticalScale(layout, dayData, baseline) {
    const graph = layout.graph;
    const baseScale = (CONFIG.BASE_VOTE_HEIGHT / CONFIG.STEP_Y) * layout.ui;
    const maxAbs = Math.max(Math.abs(dayData.minValue), Math.abs(dayData.maxValue));
    if (maxAbs === 0) return baseScale;
    // Like program 2, reserve equal room above/below the centered zero and
    // retain 12% breathing space when fitting historical extremes.
    const availableHalfHeight = Math.min(baseline - graph.y, graph.y + graph.h - baseline) * 0.88;

    // A single vote starts at 17px on the 1920x1080 canvas. Only rendering
    // shrinks to fit history; sampling and cumulative logical values stay intact.
    return Math.min(baseScale, availableHalfHeight / maxAbs);
  }
  function drawGraphAxes(layout, timing, dayData, baseline, viewEnd, yScale) {
    const graph = layout.graph;
    drawVerticalAsset(runtime.designAssets.axis, graph.x, graph.y, graph.h, 7.36396 * layout.sx);

    // Zero is the same baseline used to map every cumulative balance value.
    p.stroke(255, 45);
    p.strokeWeight(1);
    p.line(graph.x, baseline, graph.x + graph.w, baseline);
    p.stroke(255, 128);
    p.line(graph.x - 6 * layout.sx, baseline, graph.x, baseline);
    p.noStroke();
    p.fill(255, 128);
    p.textSize(12 * layout.ui);
    p.textAlign(p.RIGHT, p.CENTER);
    p.text("0", graph.x - 10 * layout.sx, baseline);
    p.noStroke();
    p.fill(255, 128);
    p.textSize(16 * layout.ui);
    p.textAlign(p.RIGHT, p.TOP);
    p.push();
    p.translate(28 * layout.sx, 292 * layout.sy);
    p.rotate(-p.HALF_PI);
    p.text("VOTING BALANCE", 0, 0);
    p.pop();
    p.textAlign(p.LEFT, p.TOP);
    p.textStyle(p.NORMAL);
  }
  function drawGraphSecondStems(layout, timing, dayData, viewEnd, baseline, yScale) {
    const graph = layout.graph;
    const tickStep = Math.max(1, Math.ceil((5 * layout.ui) / runtime.timelineSecondWidth));
    const first = Math.max(0, Math.ceil(runtime.viewStartSecond / tickStep) * tickStep);
    const last = Math.min(Math.ceil(viewEnd), Math.floor(timing.liveSecond));
    let groupIndex = viewport.lowerBoundGroup(dayData.groups, first);
    let value =
      groupIndex > 0 ? dayData.groups[groupIndex - 1].endValue : (dayData.startValue ?? 0);
    const ctx = p.drawingContext;
    ctx.save();
    ctx.setLineDash([5 * layout.ui, 6 * layout.ui]);
    p.stroke(255, 58);
    p.strokeWeight(1);
    for (let second = first; second <= last; second += tickStep) {
      while (groupIndex < dayData.groups.length && dayData.groups[groupIndex].second <= second) {
        value = dayData.groups[groupIndex].endValue;
        groupIndex++;
      }
      const x = viewport.xForSecond(second, graph);
      const y = baseline - value * yScale;
      p.line(x, y, x, graph.stemBottom ?? graph.y + graph.h);
    }
    ctx.restore();
  }
  function drawVoteTrace(layout, timing, dayData, viewEnd, baseline, yScale) {
    const graph = layout.graph;
    const groups = dayData.groups;
    const firstIndex = viewport.lowerBoundGroup(groups, Math.floor(runtime.viewStartSecond));
    let value = firstIndex > 0 ? groups[firstIndex - 1].endValue : (dayData.startValue ?? 0);
    let lastChoice =
      firstIndex > 0 ? groups[firstIndex - 1].lastChoiceAfter : (dayData.startChoice ?? 0);
    const previousBars = firstIndex > 0 ? groups[firstIndex - 1].bars : [];
    const previousBar = previousBars[previousBars.length - 1];
    let lastVoteStartValue = previousBar
      ? value - previousBar.choice * previousBar.count * CONFIG.STEP_Y
      : (dayData.startVoteStartValue ?? value);
    let cursorSecond = runtime.viewStartSecond;
    for (let i = firstIndex; i < groups.length; i++) {
      const group = groups[i];
      if (group.second > viewEnd) break;
      if (group.second > cursorSecond) {
        drawPlateau(
          Math.max(cursorSecond, runtime.viewStartSecond),
          Math.min(group.second, viewEnd),
          value,
          lastChoice,
          graph,
          baseline,
          yScale,
          layout.ui,
          lastVoteStartValue,
        );
      }
      const barCount = group.bars.length;
      for (let barIndex = 0; barIndex < barCount; barIndex++) {
        const bar = group.bars[barIndex];
        const choice = bar.choice;
        const bounds = choiceBarBounds(group.second, barIndex, barCount);
        const subStart = bounds.start;
        const subEnd = bounds.end;
        if (subEnd <= runtime.viewStartSecond) {
          lastVoteStartValue = value;
          value += choice * bar.count * CONFIG.STEP_Y;
          lastChoice = choice;
          cursorSecond = subEnd;
          continue;
        }
        if (subStart >= viewEnd) break;
        const oldValue = value;
        lastVoteStartValue = oldValue;
        value += choice * bar.count * CONFIG.STEP_Y;
        const visibleStart = Math.max(subStart, runtime.viewStartSecond);
        const visibleEnd = Math.min(subEnd, viewEnd);
        drawVoteSegment(
          visibleStart,
          visibleEnd,
          oldValue,
          value,
          choice,
          graph,
          baseline,
          yScale,
          layout.ui,
        );
        lastChoice = choice;
        cursorSecond = subEnd;
      }
    }
    const traceEnd = Math.min(timing.liveSecond, viewEnd);
    if (traceEnd > cursorSecond) {
      drawPlateau(
        Math.max(cursorSecond, runtime.viewStartSecond),
        traceEnd,
        value,
        lastChoice,
        graph,
        baseline,
        yScale,
        layout.ui,
        lastVoteStartValue,
      );
    }
    if (
      timing.active !== false &&
      timing.liveSecond >= runtime.viewStartSecond &&
      timing.liveSecond <= viewEnd
    ) {
      const x = viewport.xForSecond(timing.liveSecond, graph);
      const y = baseline - dayData.finalValue * yScale;
      p.noStroke();
      p.fill(248);
      p.circle(x, y, 9 * layout.ui);
    }
  }
  function choiceBarBounds(second, barIndex, barCount) {
    return {
      start: second + barIndex / barCount,
      end: second + (barIndex + 1) / barCount,
    };
  }
  function drawVoteSegment(
    startSecond,
    endSecond,
    oldValue,
    value,
    choice,
    graph,
    baseline,
    yScale,
    ui,
  ) {
    if (endSecond <= startSecond) return;
    const x1 = viewport.xForSecond(startSecond, graph);
    const x2 = viewport.xForSecond(endSecond, graph);
    const band = voteBandBounds(oldValue, value, baseline, yScale, ui);
    p.noStroke();
    p.fill(choiceColor(choice));
    p.rect(x1, band.y, Math.max(1, x2 - x1), band.h);
  }
  function voteBandBounds(oldValue, value, baseline, yScale, ui) {
    const oldY = baseline - oldValue * yScale;
    const newY = baseline - value * yScale;
    return {
      y: Math.min(oldY, newY),
      h: Math.max(3 * ui, Math.abs(newY - oldY)),
    };
  }
  function drawPlateau(
    startSecond,
    endSecond,
    value,
    choice,
    graph,
    baseline,
    yScale,
    ui,
    oldValue = value - choice * CONFIG.STEP_Y,
  ) {
    if (endSecond <= startSecond) return;
    const x1 = viewport.xForSecond(startSecond, graph);
    const x2 = viewport.xForSecond(endSecond, graph);
    const y = baseline - value * yScale;
    const plateauColor = choice === NO ? p.color(CONFIG.NO_COLOR) : p.color(CONFIG.YES_COLOR);
    plateauColor.setAlpha(choice === 0 ? 28 : 42);
    // Before the first vote, keep the neutral baseline band. Afterwards,
    // continue the last vote's exact bounds, including its minimum pixel height.
    const bandHeight = clamp(31 * Math.abs(yScale), 6 * ui, 31 * ui);
    const band =
      choice === 0
        ? {
            y: y - bandHeight * 0.5,
            h: bandHeight,
          }
        : voteBandBounds(oldValue, value, baseline, yScale, ui);
    p.noStroke();
    p.fill(plateauColor);
    p.rect(x1, band.y, Math.max(1, x2 - x1), band.h);
  }
  function drawLiveCursor(layout, timing) {
    const graph = layout.graph;
    if (timing.liveSecond < runtime.viewStartSecond) return;
    const x = viewport.xForSecond(timing.liveSecond, graph);
    if (x < graph.x || x > graph.x + graph.w) return;
    drawVerticalAsset(
      runtime.designAssets.liveCursor,
      x,
      graph.y,
      489 * layout.sy,
      10.6667 * layout.sx,
      5.33333 * layout.sy,
    );
  }
  function drawGraphTimestamps(layout, timing, dayData, viewEnd) {
    const graph = layout.graph;
    const ui = layout.ui;
    const tickStep = viewport.timelineTickStep(runtime.timelineSecondWidth, 52 * ui);
    const first = Math.max(0, Math.ceil(runtime.viewStartSecond / tickStep) * tickStep);
    const last = Math.min(Math.ceil(viewEnd), Math.floor(timing.liveSecond));
    p.noStroke();
    p.fill(255, 128);
    p.textSize(12 * ui);
    p.textAlign(p.LEFT, p.TOP);
    for (let second = first; second <= last; second += tickStep) {
      const x = viewport.xForSecond(second, graph);
      if (x + 46 * layout.sx > graph.x + graph.w) continue;
      p.text(formatting.formatClock(timing.displayDayStart + second * 1000), x, graph.timestampY);
    }
    p.textAlign(p.LEFT, p.TOP);
  }
  function choiceColor(choice) {
    return choice === NO ? CONFIG.NO_COLOR : CONFIG.YES_COLOR;
  }

  // -----------------------------------------------------------------------------
  // CAMERA / SCROLLING
  // -----------------------------------------------------------------------------

  // -----------------------------------------------------------------------------
  // PROMPTS / VOTE WATER-DROP BACKGROUND
  // -----------------------------------------------------------------------------

  function drawRipples(layout, nowMillis) {
    runtime.ripples = runtime.ripples.filter(
      (ripple) => nowMillis - ripple.bornAt < CONFIG.VOTE_RIPPLE_MS,
    );
    if (runtime.ripples.length === 0) return;
    // The reference anchors the drop below the lower-left part of the display.
    const centerX = 300 * layout.sx;
    const centerY = 1156 * layout.sy;
    const ctx = p.drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, layout.mainW, p.height);
    ctx.clip();
    for (const ripple of runtime.ripples) {
      const age = nowMillis - ripple.bornAt;
      const progress = clamp(age / CONFIG.VOTE_RIPPLE_MS, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const radius = p.lerp(18, CONFIG.VOTE_RIPPLE_MAX_RADIUS * layout.ui, eased);
      const opacity = Math.pow(1 - progress, 1.35) * 0.92;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      if (ripple.choice === YES) {
        gradient.addColorStop(0, CONFIG.YES_COLOR);
        gradient.addColorStop(1, "rgba(6, 255, 205, 0)");
      } else {
        gradient.addColorStop(0, CONFIG.NO_COLOR);
        gradient.addColorStop(1, "rgba(255, 109, 5, 0)");
      }
      ctx.globalAlpha = opacity;
      ctx.fillStyle = gradient;
      ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }
  function drawPrompts(layout, timing, now) {
    const promptLayout = layout.prompt;
    const ui = layout.ui;
    const visible = runtime.state.prompts.visible;
    if (visible.length === 0) return;
    const newestAnimation = clamp((p.millis() - runtime.lastPromptAddedAt) / 700, 0, 1);
    for (let i = 0; i < visible.length; i++) {
      const item = visible[i];
      const isNewest = i === visible.length - 1;
      const alphaLevels = [102, 102, 128, 153, 255];
      const rowSlot = CONFIG.MAX_VISIBLE_PROMPTS - visible.length + i;
      const alpha = alphaLevels[rowSlot];
      const enterOffset = isNewest ? (1 - easeOutCubic(newestAnimation)) * 18 * ui : 0;
      const y = promptLayout.rows[rowSlot] + enterOffset;
      // Fade only the row content, preserving the drop glow underneath.
      p.push();
      p.drawingContext.globalAlpha = clamp((y - 855 * layout.sy) / (59 * layout.sy), 0, 1);
      p.fill(255, isNewest ? 153 : alpha);
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(16 * ui);
      p.text(formatting.formatClock(item[1]), promptLayout.timestampX, y);
      const ruleNames = ["prompt40", "prompt40", "prompt50", "prompt60", "prompt100"];
      p.image(
        runtime.designAssets[ruleNames[rowSlot]],
        promptLayout.lineX,
        y - 2 * layout.sy,
        60 * layout.sx,
        2 * layout.sy,
      );
      p.noStroke();
      p.fill(255, alpha);
      const question = runtime.PROMPTS[item[0]];
      p.textSize(fittedTextSize(question, promptLayout.w, 24 * ui, 14 * ui));
      p.textAlign(p.LEFT, p.CENTER);
      p.text(question, promptLayout.questionX, y);
      p.pop();
    }

    p.textAlign(p.LEFT, p.TOP);
    p.textStyle(p.NORMAL);
  }
  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }
  function fittedTextSize(value, availableWidth, preferredSize, minimumSize) {
    let size = preferredSize;
    p.textSize(size);
    while (size > minimumSize && p.textWidth(value) > availableWidth) {
      size -= 0.5;
      p.textSize(size);
    }
    return size;
  }

  // -----------------------------------------------------------------------------
  // TIMED OPENING / CLOSING SCREENS
  // -----------------------------------------------------------------------------
  function updatePanelColor(timing) {
    if (timing.before) {
      // Only the first opening uses a neutral introduction-only panel.
      runtime.targetPanelColor = p.color(CONFIG.NEUTRAL_PANEL_COLOR);
      runtime.panelColor = p.color(runtime.targetPanelColor);
      return;
    }
    const desired = p.color(voting.panelColorForTotals());
    runtime.targetPanelColor = desired;
    runtime.panelColor = p.lerpColor(runtime.panelColor, runtime.targetPanelColor, 0.1);
  }

  // -----------------------------------------------------------------------------
  // PROMPTS
  // -----------------------------------------------------------------------------
  return {
    preload,
    drawInformationPanel,
    drawPanelRule,
    overviewXForTimestamp,
    overviewVerticalScale,
    drawOverviewGraph,
    drawMainHeader,
    drawVerticalAsset,
    drawDailyGraph,
    graphVerticalScale,
    drawGraphAxes,
    drawGraphSecondStems,
    drawVoteTrace,
    choiceBarBounds,
    drawVoteSegment,
    voteBandBounds,
    drawPlateau,
    drawLiveCursor,
    drawGraphTimestamps,
    choiceColor,
    drawRipples,
    drawPrompts,
    easeOutCubic,
    fittedTextSize,
    updatePanelColor,
  };
}

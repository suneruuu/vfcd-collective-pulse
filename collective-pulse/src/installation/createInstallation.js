import { CONFIG, YES, NO, STATE_VERSION } from "../config/installation.js";
import { createRuntime } from "./createRuntime.js";
import { createCampaign } from "./domain/campaign.js";
import { createFormatting } from "./domain/formatting.js";
import { createPersistence } from "./domain/persistence.js";
import { createVoting } from "./domain/voting.js";
import { createPrompts } from "./domain/prompts.js";
import { createPhase } from "./domain/phase.js";
import { createCamera } from "./domain/camera.js";
import { createVoteSampler } from "./domain/voteSampler.js";
import { createCanvasInput } from "./rendering/canvasInput.js";
import { createController } from "./domain/controller.js";
import { createNavigationHelper } from "./domain/navigationHelper.js";
import { createRenderer } from "./rendering/renderer.js";
import { createViewport } from "./rendering/viewport.js";
import { createQueueCache } from "../services/queueCache.js";
import { getUiSnapshot } from "./uiSnapshot.js";

// Compose independent services around one private installation session.
// No module mutates React-owned DOM or registers global browser callbacks.
export function createInstallation({
  p,
  storage,
  onSnapshot = () => {},
  focusCanvas = () => {},
  pixelRatio = 1,
  clock = Date,
}) {
  const runtime = createRuntime();
  const navigationHelper = createNavigationHelper(runtime, { clock });
  const cache = createQueueCache(storage);
  const announce = (text) => {
    runtime.status = text;
  };
  const campaign = createCampaign(runtime, {
    clock,
  });
  const formatting = createFormatting(runtime, {
    clock,
    campaign,
  });
  const persistence = createPersistence(runtime, {
    clock,
    storage,
  });
  const voting = createVoting(runtime, {
    clock,
    campaign,
  });
  const viewport = createViewport(runtime, {
    clock,
    p,
  });
  const phase = createPhase(runtime, {
    clock,
    formatting,
  });
  const camera = createCamera(runtime, {
    clock,
    announce,
    campaign,
    focusCanvas,
    formatting,
    phase,
    viewport,
  });
  const prompts = createPrompts(runtime, {
    animationClock: () => p.millis(),
    persistence,
  });
  const controller = createController(runtime, {
    clock,
    prompts,
  });
  const renderer = createRenderer(runtime, {
    clock,
    campaign,
    formatting,
    p,
    viewport,
    voting,
  });
  const sampler = createVoteSampler(runtime, {
    clock,
    campaign,
    persistence,
    voting,
    onVotes(choices, now) {
      if (!runtime.fitAll && runtime.selectedOverviewDay === null) runtime.followLive = true;
      runtime.ripples.push(
        ...choices.map((choice) => ({
          choice,
          bornAt: now,
        })),
      );
      runtime.targetPanelColor = p.color(voting.panelColorForTotals());
      const response =
        choices.length === 1 ? (choices[0] === YES ? "Yes" : "No") : choices.length + " responses";
      announce(response + " recorded. " + runtime.derived.total + " total responses.");
    },
  });
  const input = {
    ...sampler,
    ...createCanvasInput(runtime, {
      clock,
      camera,
      campaign,
      p,
      viewport,
      sampler,
    }),
  };
  function restorePromptQueueCache() {
    const queue = cache.read();
    if (!queue) return;
    runtime.managedPrompts = queue.prompts;
    runtime.PROMPTS = Object.freeze(queue.prompts.map((prompt) => prompt.text));
    runtime.promptQueueRevision = queue.revision;
  }
  function applyPromptQueue(queue) {
    prompts.applyPromptQueue(queue);
    cache.write(queue);
  }
  function setup() {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
    canvas.elt.setAttribute("tabindex", "0");
    canvas.elt.setAttribute(
      "aria-label",
      "Collective Pulse. Press left arrow for yes or right arrow for no.",
    );
    p.pixelDensity(Math.min(pixelRatio, 2));
    p.frameRate(60);
    p.textFont("Iosevka Charon");
    p.strokeCap(p.SQUARE);
    p.strokeJoin(p.MITER);
    runtime.campaignStartMs = new clock(
      CONFIG.CAMPAIGN_START_DATE + "T00:00:00" + CONFIG.CAMPAIGN_TIMEZONE_OFFSET,
    ).getTime();
    runtime.campaignEndMs = runtime.campaignStartMs + CONFIG.CAMPAIGN_DAYS * CONFIG.DAY_MS;
    persistence.clearLegacyCampaignStorage();
    restorePromptQueueCache();
    runtime.state = persistence.loadState();
    voting.rebuildDerived();
    const timing = campaign.getCampaignTiming(clock.now());
    runtime.targetPanelColor = p.color(
      timing.before ? CONFIG.NEUTRAL_PANEL_COLOR : voting.panelColorForTotals(),
    );
    runtime.panelColor = p.color(runtime.targetPanelColor);
    runtime.viewedDayIndex = timing.displayDayIndex;
    runtime.lastFrameDayIndex = timing.activeDayIndex;
    prompts.ensurePromptDay(timing, clock.now());
    input.resetInputSampling();
    navigationHelper.interact();
    focusCanvas();
    return canvas;
  }
  function draw() {
    const now = clock.now();
    navigationHelper.update(now);
    const timing = campaign.getCampaignTiming(now);
    const layout = viewport.getLayout();
    phase.updateTimedScreen(layout, timing, now);
    const graphTiming = camera.getGraphTiming(timing);
    controller.handleDayChange(timing, now);
    input.updateInputSampling(now);
    prompts.updatePromptClock(timing, now);
    camera.updateCamera(graphTiming, layout.graph);
    renderer.updatePanelColor(timing);
    p.background(0);
    renderer.drawInformationPanel(layout, timing, now);
    if (!timing.before) {
      if (timing.active) renderer.drawRipples(layout, now);
      renderer.drawMainHeader(layout);
      renderer.drawDailyGraph(layout, graphTiming, now);
      if (timing.active) {
        renderer.drawPrompts(layout, timing, now);
      }
    }
    onSnapshot(getUiSnapshot(runtime, timing, now, layout, formatting));
  }
  function windowResized() {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    runtime.viewStartSecond = camera.constrainViewStart(
      runtime.viewStartSecond,
      camera.getGraphTiming(campaign.getCampaignTiming(clock.now())),
    );
  }
  function zoom(factor) {
    camera.zoomTimeline(
      factor,
      viewport.getLayout(),
      camera.getGraphTiming(campaign.getCampaignTiming(clock.now())),
    );
    focusCanvas();
  }
  function togglePreview() {
    const timing = campaign.getCampaignTiming(clock.now());
    if (timing.before || timing.active) return;
    runtime.pulsePreview = !runtime.pulsePreview;
    if (!runtime.pulsePreview) {
      runtime.selectedOverviewDay = null;
      runtime.fitAll = true;
      runtime.followLive = false;
    }
    focusCanvas();
  }
  const actions = {
    zoomIn: () => zoom(CONFIG.ZOOM_FACTOR),
    zoomOut: () => zoom(1 / CONFIG.ZOOM_FACTOR),
    live: () => {
      camera.activateLiveView();
      focusCanvas();
    },
    fit: () => {
      camera.activateFitAll();
      focusCanvas();
    },
    toggleNavigationHelper: () => {
      navigationHelper.toggle();
      focusCanvas();
    },
    interactNavigationHelper: navigationHelper.interact,
    setNavigationHelperHovered: navigationHelper.setHovered,
    togglePreview,
    selectDay: camera.selectOverviewDay,
  };
  return {
    runtime,
    actions,
    setup,
    draw,
    windowResized,
    applyPromptQueue,
    restorePromptQueueCache,
    campaign,
    formatting,
    persistence,
    voting,
    viewport,
    phase,
    camera,
    prompts,
    input,
    renderer,
    controller,
    navigationHelper,
    constants: {
      CONFIG,
      YES,
      NO,
      STATE_VERSION,
    },
    getQueue: () => ({
      version: 1,
      revision: runtime.promptQueueRevision,
      prompts: runtime.managedPrompts,
    }),
    getRuntimeStatus: () => ({
      revision: runtime.promptQueueRevision,
      currentId: runtime.state.prompts.currentId || null,
      nextId: runtime.managedPrompts[prompts.nextManagedPromptIndex()]?.id || null,
      active: campaign.getCampaignTiming(clock.now()).active,
      campaignStartDate: CONFIG.CAMPAIGN_START_DATE,
    }),
  };
}

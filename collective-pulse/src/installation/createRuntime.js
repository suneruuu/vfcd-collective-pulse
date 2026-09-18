import { CONFIG } from "../config/installation.js";
import PromptQueue from "../../shared/prompt-queue.js";
export function createRuntime() {
  const managedPrompts = PromptQueue.defaults.map((prompt) => ({
    ...prompt,
  }));
  return {
    managedPrompts,
    PROMPTS: Object.freeze(managedPrompts.map((prompt) => prompt.text)),
    campaignStartMs: 0,
    campaignEndMs: 0,
    state: undefined,
    derived: undefined,
    panelColor: undefined,
    targetPanelColor: undefined,
    storageFailed: false,
    followLive: true,
    fitAll: false,
    viewStartSecond: 0,
    viewedDayIndex: 0,
    dragState: null,
    timelineSecondWidth: CONFIG.SECOND_WIDTH,
    zoomSecondWidth: CONFIG.SECOND_WIDTH,
    pendingVotes: [],
    heldDirections: new Set(),
    lastSampleClock: 0,
    ripples: [],
    lastPromptAddedAt: 0,
    lastFrameDayIndex: null,
    informationPanelVisible: true,
    pulsePreview: false,
    timedStateKey: null,
    openViewState: null,
    selectedOverviewDay: null,
    designAssets: {},
    timedScreen: null,
    status: "",
    promptQueueRevision: null,
  };
}

import { CONFIG, STATE_VERSION, YES, NO } from "../../config/installation.js";
import PromptQueue from "../../../shared/prompt-queue.js";
export function createPersistence(runtime, { storage }) {
  // -----------------------------------------------------------------------------
  // CAMPAIGN STATE
  // -----------------------------------------------------------------------------

  function createEmptyState() {
    return {
      version: STATE_VERSION,
      campaignStartDate: CONFIG.CAMPAIGN_START_DATE,
      votes: [],
      lastLeader: 0,
      prompts: {
        dayIndex: null,
        nextIndex: 0,
        currentId: null,
        queueIds: runtime.managedPrompts.map((prompt) => prompt.id),
        visible: [],
        lastShownAt: null,
        armedAt: null,
      },
    };
  }
  function createInitialState() {
    const initial = createEmptyState();
    if (CONFIG.SEED_DEMO_DATA) initial.votes = createDemoVotesForYesterday();
    return initial;
  }
  function createDemoVotesForYesterday() {
    const votes = [];
    const yesPattern = [3, 2, 4, 1, 3, 2, 1, 4];
    const noPattern = [1, 3, 1, 2, 0, 4, 2, 1];
    const firstBucketSecond = 8 * 60 * 60;
    const bucketSpacingSeconds = 15 * 60;
    for (let bucketIndex = 0; bucketIndex < 48; bucketIndex++) {
      const second = firstBucketSecond + bucketIndex * bucketSpacingSeconds;
      const bucketTimestamp = runtime.campaignStartMs + second * 1000;
      const yesCount = yesPattern[bucketIndex % yesPattern.length];
      const noCount = noPattern[bucketIndex % noPattern.length];
      for (let index = 0; index < yesCount; index++) {
        votes.push([bucketTimestamp + index * 40, YES]);
      }
      for (let index = 0; index < noCount; index++) {
        votes.push([bucketTimestamp + (yesCount + index) * 40, NO]);
      }
    }
    return votes;
  }
  function clearLegacyCampaignStorage() {
    try {
      // Keep this storage version's other date-keyed sessions so switching
      // between a test week and the event week does not erase collected votes.
      const currentVersionPrefix = `${CONFIG.STORAGE_KEY}:`;
      const keysToRemove = [];
      for (let index = 0; index < storage.length; index++) {
        const keyName = storage.key(index);
        if (
          keyName &&
          keyName.startsWith(CONFIG.STORAGE_NAMESPACE) &&
          !keyName.startsWith(currentVersionPrefix)
        ) {
          keysToRemove.push(keyName);
        }
      }
      for (const keyName of keysToRemove) storage.removeItem(keyName);
    } catch (error) {
      console.warn("Collective Pulse could not clear its previous campaign data.", error);
    }
  }
  function loadState() {
    try {
      const raw = storage.getItem(storageKey());
      if (!raw) return createInitialState();
      const saved = JSON.parse(raw);
      if (
        !saved ||
        saved.version !== STATE_VERSION ||
        saved.campaignStartDate !== CONFIG.CAMPAIGN_START_DATE ||
        !Array.isArray(saved.votes)
      ) {
        return createInitialState();
      }
      const cleaned = createEmptyState();
      cleaned.votes = saved.votes
        .filter(
          (vote) =>
            Array.isArray(vote) &&
            Number.isFinite(vote[0]) &&
            (vote[1] === YES || vote[1] === NO) &&
            vote[0] >= runtime.campaignStartMs &&
            vote[0] < runtime.campaignEndMs,
        )
        .map((vote) => [vote[0], vote[1]])
        .sort((a, b) => a[0] - b[0]);
      cleaned.lastLeader = saved.lastLeader === NO ? NO : saved.lastLeader === YES ? YES : 0;
      if (saved.prompts && typeof saved.prompts === "object") {
        const promptState = saved.prompts;
        cleaned.prompts.dayIndex = Number.isInteger(promptState.dayIndex)
          ? promptState.dayIndex
          : null;
        const savedIds = Array.isArray(promptState.queueIds)
          ? promptState.queueIds
          : PromptQueue.defaults.map((prompt) => prompt.id);
        const currentIds = runtime.managedPrompts.map((prompt) => prompt.id);
        cleaned.prompts.nextIndex = Math.max(
          0,
          currentIds.indexOf(savedIds[promptState.nextIndex]),
        );
        cleaned.prompts.currentId =
          typeof promptState.currentId === "string" ? promptState.currentId : null;
        cleaned.prompts.visible = Array.isArray(promptState.visible)
          ? promptState.visible
              .filter(
                (item) =>
                  Array.isArray(item) &&
                  Number.isInteger(item[0]) &&
                  item[0] >= 0 &&
                  item[0] < savedIds.length &&
                  Number.isFinite(item[1]),
              )
              .flatMap(([index, timestamp]) => {
                const remapped = currentIds.indexOf(savedIds[index]);
                return remapped >= 0 && !runtime.managedPrompts[remapped].hidden
                  ? [[remapped, timestamp]]
                  : [];
              })
              .slice(-CONFIG.MAX_VISIBLE_PROMPTS)
          : [];
        cleaned.prompts.lastShownAt = Number.isFinite(promptState.lastShownAt)
          ? promptState.lastShownAt
          : null;
        cleaned.prompts.armedAt = Number.isFinite(promptState.armedAt) ? promptState.armedAt : null;
        if (!cleaned.prompts.currentId && cleaned.prompts.visible.length) {
          cleaned.prompts.currentId = runtime.managedPrompts[cleaned.prompts.visible.at(-1)[0]].id;
        }
      }
      return cleaned;
    } catch (error) {
      console.warn("Collective Pulse could not restore its local state.", error);
      runtime.storageFailed = true;
      return createInitialState();
    }
  }
  function saveState() {
    try {
      storage.setItem(storageKey(), JSON.stringify(runtime.state));
      runtime.storageFailed = false;
    } catch (error) {
      console.warn("Collective Pulse could not save its local state.", error);
      runtime.storageFailed = true;
    }
  }
  function storageKey() {
    return `${CONFIG.STORAGE_KEY}:${CONFIG.CAMPAIGN_START_DATE}`;
  }
  return {
    createEmptyState,
    createInitialState,
    createDemoVotesForYesterday,
    clearLegacyCampaignStorage,
    loadState,
    saveState,
    storageKey,
  };
}

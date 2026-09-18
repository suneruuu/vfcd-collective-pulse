import { CONFIG, YES, NO } from "../../config/installation.js";
export function createVoteSampler(
  runtime,
  {
    campaign,
    onVotes,
    persistence,
    voting,
    clock = Date,
    submitVotes = null,
    canVote = () => true,
  },
) {
  function recordVote(choice, now = clock.now()) {
    return recordVotes([choice], now);
  }
  function recordVotes(choices, now = clock.now()) {
    const timing = campaign.getCampaignTiming(now);
    if (!timing.active || !canVote() || choices.length === 0) return false;
    if (!choices.every((choice) => choice === YES || choice === NO)) return false;
    if (submitVotes) {
      void submitVotes(choices.slice(0, 256));
      return true;
    }

    // All responses in this sample share one timestamp. Rebuild and save once
    // for the whole batch, rather than repeatedly for every concurrent press.
    for (const choice of choices) {
      runtime.state.votes.push([now, choice]);
    }
    voting.rebuildDerived();
    persistence.saveState();
    onVotes(choices, now);
    return true;
  }
  // Sample every queued press and each held direction independently of browser
  // key repeat. Idle seconds keep the current value without adding a response.
  // Sample every queued press and each held direction independently of browser
  // key repeat. Idle seconds keep the current value without adding a response.
  function resetInputSampling(now = clock.now()) {
    runtime.pendingVotes.length = 0;
    runtime.heldDirections.clear();
    runtime.lastSampleClock = now;
  }
  function updateInputSampling(now = clock.now()) {
    if (!canVote()) {
      resetInputSampling(now);
      return;
    }
    const intervalsPassed = Math.floor((now - runtime.lastSampleClock) / CONFIG.INPUT_SAMPLE_MS);
    if (intervalsPassed < 1) {
      if (!campaign.getCampaignTiming(now).active) resetInputSampling(now);
      return;
    }
    if (runtime.pendingVotes.length === 0 && runtime.heldDirections.size === 0) {
      runtime.lastSampleClock += intervalsPassed * CONFIG.INPUT_SAMPLE_MS;
      return;
    }

    // Bound catch-up work just as in program 2 so a slow frame stays responsive.
    const sampleCount = submitVotes ? 1 : Math.min(intervalsPassed, 240);
    if (submitVotes && intervalsPassed > 1) runtime.lastSampleClock = now - CONFIG.INPUT_SAMPLE_MS;
    for (let i = 0; i < sampleCount; i++) {
      runtime.lastSampleClock += CONFIG.INPUT_SAMPLE_MS;
      if (!campaign.getCampaignTiming(runtime.lastSampleClock).active) {
        resetInputSampling(now);
        break;
      }
      const choices = runtime.pendingVotes.splice(0);
      const pressedDirections = new Set(choices);
      for (const direction of runtime.heldDirections) {
        // A fresh press already counts for this tick; holding must not double it.
        if (!pressedDirections.has(direction)) choices.push(direction);
      }
      recordVotes(choices, runtime.lastSampleClock);
    }
    if (!campaign.getCampaignTiming(now).active) resetInputSampling(now);
  }
  function queueDirection(direction, now = clock.now()) {
    // Finish elapsed samples before applying a newly pressed direction.
    updateInputSampling(now);
    if (!campaign.getCampaignTiming(now).active || !canVote()) return false;
    if (direction !== YES && direction !== NO) return false;
    runtime.pendingVotes.push(direction);
    runtime.heldDirections.add(direction);
    return true;
  }
  // -----------------------------------------------------------------------------
  // INPUT
  // -----------------------------------------------------------------------------
  return {
    recordVote,
    recordVotes,
    resetInputSampling,
    updateInputSampling,
    queueDirection,
  };
}

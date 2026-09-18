import { createExternalStore } from "./externalStore.js";

export function campaignIsActive(campaign, now) {
  if (!campaign) return false;
  const dayMs = 86400000;
  const day = Math.floor((now - campaign.startMs) / dayMs);
  const elapsed = now - campaign.startMs - day * dayMs;
  return (
    day >= 0 &&
    day < campaign.days &&
    elapsed >= campaign.openHour * 3600000 &&
    elapsed < campaign.closeHour * 3600000
  );
}

export function createCloudConnection({
  api,
  includeVotes = true,
  onPulse = () => {},
  onVotes = () => {},
  scheduler = globalThis,
  clock = Date,
  newId = () => crypto.randomUUID(),
}) {
  const store = createExternalStore({
    connected: false,
    campaign: null,
    offset: 0,
    message: "Connecting...",
  });
  const uncertain = new Map();
  let cursor = 0,
    timer = null,
    controller = new AbortController(),
    generation = 0,
    reading = false,
    initialized = false;
  const publish = (patch) => store.publish({ ...store.getSnapshot(), ...patch });
  const isCurrent = (signal, epoch) => !signal.aborted && epoch === generation;
  const now = () => clock.now() + store.getSnapshot().offset;
  const canVote = () =>
    store.getSnapshot().connected && campaignIsActive(store.getSnapshot().campaign, now());

  async function submitBatch(batch, signal, epoch) {
    try {
      const data = await api.submitVotes(batch.id, batch.choices, signal);
      if (!isCurrent(signal, epoch)) return false;
      uncertain.delete(batch.id);
      onVotes(data.votes, true, true);
      publish({ message: batch.choices.length === 1 ? "Response saved." : "Responses saved." });
      return true;
    } catch (error) {
      if (!isCurrent(signal, epoch)) return false;
      if (!error.status) {
        uncertain.set(batch.id, batch);
        publish({ connected: false, message: "Connection lost. Reconnecting..." });
      } else {
        uncertain.delete(batch.id);
        publish({ message: error.message });
        if (error.status === 409) publish({ connected: false });
      }
      return false;
    }
  }

  async function syncOnce() {
    if (reading) return;
    const signal = controller.signal,
      epoch = generation;
    reading = true;
    try {
      let data;
      do {
        const started = clock.now();
        data = await api.getPulse(cursor, includeVotes, signal);
        if (!isCurrent(signal, epoch)) return;
        const offset = data.serverNow - (started + clock.now()) / 2;
        onPulse(data);
        onVotes(data.votes || [], false, initialized);
        cursor = data.cursor;
        publish({ connected: true, campaign: data.campaign, offset, message: "" });
      } while (includeVotes && data.hasMore);
      initialized = true;
      for (const batch of [...uncertain.values()]) {
        if (!isCurrent(signal, epoch)) return;
        await submitBatch(batch, signal, epoch);
        if (!store.getSnapshot().connected) break;
      }
    } catch (error) {
      if (isCurrent(signal, epoch))
        publish({
          connected: false,
          message: error.message || "Cannot reach online voting. Reconnecting...",
        });
    } finally {
      if (epoch === generation) reading = false;
    }
  }
  return {
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
    now,
    canVote,
    syncOnce,
    submit(choices) {
      if (
        !canVote() ||
        !choices.length ||
        choices.length > 256 ||
        choices.some((choice) => choice !== 1 && choice !== -1)
      )
        return Promise.resolve(false);
      return submitBatch({ id: newId(), choices: [...choices] }, controller.signal, generation);
    },
    start() {
      if (timer !== null) return;
      generation++;
      controller = new AbortController();
      reading = false;
      publish({ connected: false, message: "Connecting..." });
      syncOnce();
      timer = scheduler.setInterval(syncOnce, 2000);
    },
    stop() {
      generation++;
      controller.abort();
      if (timer !== null) scheduler.clearInterval(timer);
      timer = null;
      reading = false;
    },
  };
}

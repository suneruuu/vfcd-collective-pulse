import Queue from "../../shared/prompt-queue.js";
export function createPromptSynchronizer({ api, installation, scheduler = globalThis }) {
  let active = false,
    request = null,
    timer = null;
  async function syncOnce() {
    if (request) return;
    const currentRequest = new AbortController();
    request = currentRequest;
    try {
      const queue = Queue.validate(await api.getQueue(currentRequest.signal));
      if (currentRequest.signal.aborted) return;
      const current = installation.getQueue();
      if (
        current.revision !== queue.revision ||
        JSON.stringify(current.prompts) !== JSON.stringify(queue.prompts)
      )
        installation.applyPromptQueue(queue);
      await api.reportRuntime(installation.getRuntimeStatus(), currentRequest.signal);
    } catch {
      /* The saved display and voting continue during an outage. */
    } finally {
      if (request === currentRequest) request = null;
    }
  }
  return {
    syncOnce,
    start() {
      if (active) return;
      active = true;
      syncOnce();
      timer = scheduler.setInterval(syncOnce, 2000);
    },
    stop() {
      active = false;
      if (timer !== null) scheduler.clearInterval(timer);
      timer = null;
      request?.abort();
      request = null;
    },
  };
}

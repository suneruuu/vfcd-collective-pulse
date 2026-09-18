import Queue from "../../shared/prompt-queue.js";
import { createExternalStore } from "../services/externalStore.js";
export function createQueueManager(api, scheduler = globalThis) {
  const store = createExternalStore({
    queue: null,
    connected: false,
    busy: false,
    message: "Loading questions...",
    error: false,
  });
  let generation = 0,
    refreshRequest = null,
    timer = null,
    controller = new AbortController();
  const publish = (patch) =>
    store.publish({
      ...store.getSnapshot(),
      ...patch,
    });
  const validate = (data) => ({
    ...Queue.validate(data),
    installation: data.installation || {
      online: false,
    },
  });
  async function refresh() {
    if (refreshRequest || store.getSnapshot().busy) return;
    const request = {
      generation,
      signal: controller.signal,
    };
    refreshRequest = request;
    try {
      const queue = validate(await api.getQueue(request.signal));
      if (request.signal.aborted || request.generation !== generation) return;
      const wasConnected = store.getSnapshot().connected;
      publish({
        queue,
        connected: true,
        ...(!wasConnected
          ? {
              message: "Questions loaded. Changes save automatically.",
              error: false,
            }
          : {}),
      });
    } catch (error) {
      if (!request.signal.aborted && request.generation === generation)
        publish({
          connected: false,
          message: error.message,
          error: true,
        });
    } finally {
      if (refreshRequest === request) refreshRequest = null;
    }
  }
  async function mutate(operation) {
    const current = store.getSnapshot(),
      signal = controller.signal;
    if (signal.aborted || current.busy || !current.queue || !current.connected) return false;
    generation++;
    publish({
      busy: true,
      message: "Saving changes...",
      error: false,
    });
    try {
      const queue = validate(
        await api.updateQueue(
          {
            revision: current.queue.revision,
            ...operation,
          },
          signal,
        ),
      );
      if (signal.aborted) return false;
      publish({
        queue,
        connected: true,
        message: "Saved on the installation computer.",
        error: false,
      });
      return true;
    } catch (error) {
      if (signal.aborted) return false;
      if (error.status === 409) {
        try {
          const queue = validate(await api.getQueue(signal));
          if (!signal.aborted)
            publish({
              queue,
              connected: true,
            });
        } catch {
          if (!signal.aborted)
            publish({
              connected: false,
            });
        }
      } else if (!error.status)
        publish({
          connected: false,
        });
      if (!signal.aborted)
        publish({
          message: error.message,
          error: true,
        });
      return false;
    } finally {
      if (!signal.aborted)
        publish({
          busy: false,
        });
    }
  }
  function move(id, targetIndex) {
    const ids = store.getSnapshot().queue?.prompts.map((prompt) => prompt.id) || [];
    const previous = ids.indexOf(id);
    if (previous < 0 || targetIndex < 0 || targetIndex >= ids.length || previous === targetIndex)
      return Promise.resolve(false);
    ids.splice(previous, 1);
    ids.splice(targetIndex, 0, id);
    return mutate({
      operation: "reorder",
      ids,
    });
  }
  return {
    ...store,
    refresh,
    mutate,
    move,
    start() {
      if (timer !== null) return;
      controller = new AbortController();
      publish({
        busy: false,
      });
      refresh();
      timer = scheduler.setInterval(refresh, 2000);
    },
    stop() {
      generation++;
      controller.abort();
      refreshRequest = null;
      if (timer !== null) scheduler.clearInterval(timer);
      timer = null;
    },
  };
}

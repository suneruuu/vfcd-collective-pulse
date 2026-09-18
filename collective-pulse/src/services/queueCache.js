import Queue from "../../shared/prompt-queue.js";
export const PROMPT_CACHE_KEY = "collective-pulse-prompt-queue-v1";
export function createQueueCache(storage) {
  return {
    read() {
      try {
        const raw = storage.getItem(PROMPT_CACHE_KEY);
        return raw ? Queue.validate(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    write(queue) {
      try {
        storage.setItem(PROMPT_CACHE_KEY, JSON.stringify(queue));
        return true;
      } catch {
        return false;
      }
    },
  };
}

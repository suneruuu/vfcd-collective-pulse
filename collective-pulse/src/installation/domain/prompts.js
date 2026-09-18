import { CONFIG } from "../../config/installation.js";
import PromptQueue from "../../../shared/prompt-queue.js";
export function createPrompts(runtime, { animationClock, persistence }) {
  function ensurePromptDay(timing, now) {
    if (!timing.active) return;
    if (runtime.state.prompts.dayIndex === timing.activeDayIndex) return;
    runtime.state.prompts.dayIndex = timing.activeDayIndex;
    runtime.state.prompts.currentId = null;
    runtime.state.prompts.visible = [];
    runtime.state.prompts.lastShownAt = null;
    runtime.state.prompts.armedAt = now;
    persistence.saveState();
  }
  function updatePromptClock(timing, now) {
    if (!timing.active || runtime.PROMPTS.length === 0) return;
    ensurePromptDay(timing, now);
    const anchor = runtime.state.prompts.lastShownAt || runtime.state.prompts.armedAt || now;
    if (now - anchor >= CONFIG.PROMPT_INTERVAL_MS) {
      appendPrompt(now);
    }
  }
  function appendPrompt(now) {
    const promptIndex = nextManagedPromptIndex();
    if (promptIndex < 0) return;
    runtime.state.prompts.visible.push([promptIndex, now]);
    runtime.state.prompts.visible = runtime.state.prompts.visible.slice(
      -CONFIG.MAX_VISIBLE_PROMPTS,
    );
    runtime.state.prompts.nextIndex = (promptIndex + 1) % runtime.PROMPTS.length;
    runtime.state.prompts.currentId = runtime.managedPrompts[promptIndex].id;
    runtime.state.prompts.lastShownAt = now;
    runtime.state.prompts.armedAt = now;
    runtime.lastPromptAddedAt = animationClock();
    persistence.saveState();
  }

  // -----------------------------------------------------------------------------
  // LAYOUT
  // -----------------------------------------------------------------------------

  function nextManagedPromptIndex() {
    const currentIndex = runtime.managedPrompts.findIndex(
      (prompt) => prompt.id === runtime.state.prompts.currentId,
    );
    return PromptQueue.nextIndex(
      runtime.managedPrompts,
      currentIndex >= 0 ? currentIndex + 1 : runtime.state.prompts.nextIndex,
    );
  }
  function applyPromptQueue(document) {
    const queue = PromptQueue.validate(document);
    const previousIds = runtime.managedPrompts.map((prompt) => prompt.id);
    const nextIds = queue.prompts.map((prompt) => prompt.id);
    const oldNextId = previousIds[runtime.state.prompts.nextIndex];
    runtime.state.prompts.visible = runtime.state.prompts.visible.flatMap(([index, shownAt]) => {
      const nextIndex = nextIds.indexOf(previousIds[index]);
      return nextIndex >= 0 && !queue.prompts[nextIndex].hidden ? [[nextIndex, shownAt]] : [];
    });
    runtime.managedPrompts = queue.prompts;
    runtime.PROMPTS = Object.freeze(queue.prompts.map((prompt) => prompt.text));
    runtime.state.prompts.nextIndex = Math.max(0, nextIds.indexOf(oldNextId));
    if (!runtime.state.prompts.currentId) {
      while (
        runtime.state.prompts.nextIndex > 0 &&
        !previousIds.includes(nextIds[runtime.state.prompts.nextIndex - 1])
      )
        runtime.state.prompts.nextIndex--;
    }
    runtime.state.prompts.queueIds = nextIds;
    runtime.promptQueueRevision = queue.revision;
    persistence.saveState();
  }
  return {
    ensurePromptDay,
    updatePromptClock,
    appendPrompt,
    nextManagedPromptIndex,
    applyPromptQueue,
  };
}

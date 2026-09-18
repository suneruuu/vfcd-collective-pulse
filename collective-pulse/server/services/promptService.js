import { randomUUID } from "node:crypto";
import { applyQueueOperation } from "../../shared/queueOperations.js";
export function createPromptService(repository, tracker) {
  const read = () => ({
    ...repository.read(),
    installation: tracker.read(),
  });
  return {
    read,
    update(body) {
      repository.save(applyQueueOperation(repository.read(), body, tracker.read(), randomUUID));
      return read();
    },
    report(body) {
      tracker.report(body, repository.read().revision);
      return {
        ok: true,
      };
    },
  };
}

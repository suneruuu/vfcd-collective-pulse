import { QueueError } from "../../shared/queueOperations.js";
export function createRuntimeTracker(clock = Date.now) {
  let runtime = null;
  return {
    read() {
      return runtime && clock() - runtime.seenAt < 15000
        ? {
            ...runtime,
            online: true,
          }
        : {
            online: false,
          };
    },
    report(body, revision) {
      if (
        !Number.isSafeInteger(body.revision) ||
        body.revision < 0 ||
        body.revision > revision ||
        typeof body.active !== "boolean" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.campaignStartDate || "") ||
        [body.currentId, body.nextId].some(
          (id) => id !== null && (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id)),
        )
      )
        throw new QueueError(400, "Invalid installation status.");
      runtime = {
        revision: body.revision,
        active: body.active,
        currentId: body.currentId,
        nextId: body.nextId,
        campaignStartDate: body.campaignStartDate,
        seenAt: clock(),
      };
    },
  };
}

import Queue from "./prompt-queue.js";
export class QueueError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new QueueError(status, message);
};
export function applyQueueOperation(queue, body, live, newId) {
  if (body.revision !== queue.revision)
    fail(409, "The queue changed on another device. Review the latest queue and try again.");
  const prompts = queue.prompts.map((prompt) => ({
    ...prompt,
  }));
  if (body.operation === "add") {
    if (prompts.length >= 500) fail(400, "The queue is full (500 questions).");
    const prompt = {
      id: newId(),
      text: Queue.cleanText(body.text),
      hidden: false,
    };
    if (body.position === "next") {
      if (!live.online || live.revision !== queue.revision)
        fail(
          409,
          "Wait for the installation to connect and receive the latest queue before adding to next.",
        );
      const current = prompts.findIndex((item) => item.id === live.currentId),
        next = prompts.findIndex((item) => item.id === live.nextId);
      prompts.splice(current >= 0 ? current + 1 : Math.max(0, next), 0, prompt);
    } else if (body.position === "bottom") prompts.push(prompt);
    else fail(400, "Choose next or bottom.");
  } else if (["edit", "visibility"].includes(body.operation)) {
    const prompt = prompts.find((item) => item.id === body.id);
    if (!prompt) fail(404, "Question no longer exists.");
    if (body.operation === "edit") prompt.text = Queue.cleanText(body.text);
    else {
      if (typeof body.hidden !== "boolean") fail(400, "Invalid visibility.");
      prompt.hidden = body.hidden;
    }
  } else if (body.operation === "delete") {
    const index = prompts.findIndex((prompt) => prompt.id === body.id);
    if (index < 0) fail(404, "Question no longer exists.");
    prompts.splice(index, 1);
  } else if (body.operation === "reorder") {
    if (
      !Array.isArray(body.ids) ||
      body.ids.length !== prompts.length ||
      new Set(body.ids).size !== prompts.length ||
      body.ids.some((id) => !prompts.some((prompt) => prompt.id === id))
    )
      fail(400, "Reorder must include every question exactly once.");
    const ordered = body.ids.map((id) => prompts.find((prompt) => prompt.id === id));
    prompts.splice(0, prompts.length, ...ordered);
  } else fail(400, "Unknown queue operation.");
  return Queue.validate({
    version: 1,
    revision: queue.revision + 1,
    prompts,
  });
}

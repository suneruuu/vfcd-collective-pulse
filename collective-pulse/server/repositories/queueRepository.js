import fs from "node:fs";
import path from "node:path";
import Queue from "../../shared/prompt-queue.js";
export function createQueueRepository(dataFile) {
  let queue;
  try {
    queue = Queue.validate(JSON.parse(fs.readFileSync(dataFile, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT")
      throw new Error(
        "Cannot load question queue: " +
          error.message +
          ". Restore the data file from a backup before restarting.",
      );
    queue = {
      version: 1,
      revision: 0,
      prompts: Queue.defaults.map((prompt) => ({
        ...prompt,
      })),
    };
  }
  function save(next) {
    fs.mkdirSync(path.dirname(dataFile), {
      recursive: true,
    });
    fs.writeFileSync(dataFile + ".tmp", JSON.stringify(next, null, 2) + "\n", {
      mode: 0o600,
    });
    fs.renameSync(dataFile + ".tmp", dataFile);
    queue = next;
  }
  if (!fs.existsSync(dataFile)) save(queue);
  return {
    read: () => queue,
    save,
  };
}

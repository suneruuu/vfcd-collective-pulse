const path = require("node:path");
const { spawnSync } = require("node:child_process");
const project = path.join(__dirname, "..");
for (const name of [
  "audio",
  "logic",
  "design",
  "schedule",
  "overview",
  "prompt",
  "react",
  "reordering",
  "cloud",
  "cloud-http",
]) {
  const result = spawnSync(process.execPath, [path.join(project, "tests", name + "-check.cjs")], {
    cwd: project,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

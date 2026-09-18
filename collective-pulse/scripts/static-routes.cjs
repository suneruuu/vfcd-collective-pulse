const fs = require("node:fs");
const path = require("node:path");
const dist = path.join(__dirname, "../dist");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
for (const route of ["vote/index.html", "prompts/index.html", "prompts.html", "vote.html"]) {
  const target = path.join(dist, route);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
}

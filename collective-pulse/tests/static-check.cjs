const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dist = path.resolve(__dirname, "../dist");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const base = process.env.VITE_BASE_PATH || "/";
for (const route of ["vote/index.html", "prompts/index.html", "vote.html", "prompts.html"]) {
  const entry = fs.readFileSync(path.join(dist, route), "utf8");
  assert.equal(entry, html, route + " must load the same app for direct visits");
}
const links = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((url) => !/^https?:/.test(url));
assert(links.length >= 2, "The built page must link its JavaScript and stylesheet");
for (const url of links) {
  assert(url.startsWith(base), "Broken repository prefix: " + url);
  const filename = path.resolve(dist, url.slice(base.length));
  assert(filename.startsWith(dist + path.sep), "Asset must remain within dist");
  assert(fs.existsSync(filename), "Missing built asset: " + url);
}
const files = fs.readdirSync(path.join(dist, "assets"));
assert(
  files.includes("live.svg") &&
    files.includes("prompt-100.svg") &&
    files.includes("queue-trash.svg"),
  "Original display assets must be deployed",
);
const scripts = files.filter((file) => /^index-.*\.js$/.test(file));
assert(
  scripts.some((file) => fs.readFileSync(path.join(dist, "assets", file), "utf8").includes(base)),
  "The app must use the same base path as its entry pages",
);
console.log(
  "Static checks passed: voting and manager entries, script/style paths, and original display assets under " +
    base,
);

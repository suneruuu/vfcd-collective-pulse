import fs from "node:fs";
import path from "node:path";
import { sendJson } from "./responses.js";
export function createFrontendHandler(dist) {
  const files = new Set();
  function scan(directory, prefix = "") {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {
      withFileTypes: true,
    })) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const name = prefix + entry.name;
      if (entry.isDirectory()) scan(path.join(directory, entry.name), name + "/");
      else files.add(name);
    }
  }
  scan(dist);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
  };
  return (request, response, url) => {
    if (!["GET", "HEAD"].includes(request.method))
      return sendJson(response, 405, {
        error: "Method not allowed.",
      });
    const route = decodeURIComponent(url.pathname);
    const file = ["/", "/index.html", "/prompts", "/prompts/", "/prompts.html"].includes(route)
      ? "index.html"
      : route.slice(1);
    if (!files.has(file))
      return sendJson(response, 404, {
        error: files.has("index.html")
          ? "Not found."
          : "Build the React app with npm run build before starting the installation.",
      });
    const contents = fs.readFileSync(path.join(dist, file));
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Content-Length": contents.length,
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  };
}

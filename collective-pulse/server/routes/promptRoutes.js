import { readJson } from "../http/readJson.js";
import { sendJson } from "../http/responses.js";
export async function handlePromptRoute(request, response, url, service, publicOrigin) {
  if (url.pathname === "/api/prompts") {
    if (request.method === "GET") sendJson(response, 200, service.read());
    else if (request.method === "POST")
      sendJson(response, 200, service.update(await readJson(request, publicOrigin)));
    else
      sendJson(response, 405, {
        error: "Method not allowed.",
      });
    return true;
  }
  if (url.pathname === "/api/runtime") {
    if (request.method !== "POST")
      sendJson(response, 405, {
        error: "Method not allowed.",
      });
    else sendJson(response, 200, service.report(await readJson(request, publicOrigin)));
    return true;
  }
  return false;
}

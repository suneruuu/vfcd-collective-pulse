import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createQueueRepository } from "./repositories/queueRepository.js";
import { createRuntimeTracker } from "./services/runtimeTracker.js";
import { createPromptService } from "./services/promptService.js";
import { handlePromptRoute } from "./routes/promptRoutes.js";
import { setResponseHeaders, sendError, sendJson } from "./http/responses.js";
import { createFrontendHandler } from "./http/serveFrontend.js";
const project = fileURLToPath(new URL("../", import.meta.url));
export function createInstallationServer(options = {}) {
  const root = options.root || project;
  const repository = createQueueRepository(
    options.dataFile || path.join(root, ".pulse-data", "prompts.json"),
  );
  const service = createPromptService(repository, createRuntimeTracker(options.clock));
  const frontend = options.frontend || createFrontendHandler(path.join(root, "dist"));
  return http.createServer(async (request, response) => {
    setResponseHeaders(response);
    try {
      const url = new URL(request.url, "http://localhost");
      if (
        await handlePromptRoute(
          request,
          response,
          url,
          service,
          options.publicOrigin || process.env.PUBLIC_ORIGIN,
        )
      )
        return;
      if (url.pathname.startsWith("/api/"))
        return sendJson(response, 404, {
          error: "Not found.",
        });
      frontend(request, response, url);
    } catch (error) {
      sendError(response, error);
    }
  });
}

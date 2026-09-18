import { QueueError } from "../../shared/queueOperations.js";
export async function readJson(request, publicOrigin) {
  if (
    request.headers["x-collective-pulse"] !== "1" ||
    !/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")
  )
    throw new QueueError(403, "This request must come from Collective Pulse.");
  const origin = request.headers.origin;
  if (origin) {
    let source;
    try {
      source = new URL(origin);
    } catch {
      throw new QueueError(403, "Invalid request origin.");
    }
    if (source.host !== request.headers.host && origin !== publicOrigin)
      throw new QueueError(403, "Open this page from the installation's address.");
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 65536) throw new QueueError(413, "Request is too large.");
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new QueueError(400, "Invalid JSON request.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new QueueError(400, "Invalid request.");
  return body;
}

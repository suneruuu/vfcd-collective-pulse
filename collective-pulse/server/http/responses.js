export function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}
export function setResponseHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
}
export function sendError(response, error) {
  const status = error.status || (error.code === "ENOENT" ? 404 : error.code ? 500 : 400);
  if (status === 500) console.error("Collective Pulse service error:", error.message);
  if (!response.headersSent)
    sendJson(response, status, {
      error:
        status === 500
          ? "Could not save the queue. Check the installation computer's disk and try again."
          : error.message,
    });
  else response.end();
}

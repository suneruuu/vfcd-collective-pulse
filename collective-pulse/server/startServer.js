import { createInstallationServer } from "./createServer.js";
export async function startInstallationServer({
  dev = false,
  port = Number(process.env.PORT || 8000),
} = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be between 1 and 65535.");
  let vite;
  if (dev) {
    const { createServer } = await import("vite");
    vite = await createServer({
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });
  }
  const server = createInstallationServer({
    frontend: vite ? (request, response) => vite.middlewares(request, response) : undefined,
  });
  server.on("close", () => vite?.close());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(
    "Installation: http://localhost:" +
      port +
      "/\nQuestion queue: http://localhost:" +
      port +
      "/prompts\nPrivate remote access: tailscale serve --bg http://127.0.0.1:" +
      port,
  );
  return server;
}

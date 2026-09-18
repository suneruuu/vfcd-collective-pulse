import path from "node:path";
import { fileURLToPath } from "node:url";
import { startInstallationServer } from "./server/startServer.js";
export { createInstallationServer } from "./server/createServer.js";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startInstallationServer({ dev: process.argv.includes("--dev") }).catch((error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? "The installation port is in use. Stop the previous server before restarting."
        : error.message,
    );
    process.exitCode = 1;
  });
}

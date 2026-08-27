import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const defaultHost = "127.0.0.1";
const defaultPort = 4173;

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

export async function startStaticServer({
  host = defaultHost,
  port = defaultPort,
  outputDirectory = "out",
} = {}) {
  const outputRoot = resolve(outputDirectory);
  const outputRootPrefix = `${outputRoot}${sep}`;
  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendText(response, 405, "Method Not Allowed");
      return;
    }

    let pathname;

    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname);
    } catch {
      sendText(response, 400, "Bad Request");
      return;
    }

    const relativePath = pathname.endsWith("/")
      ? `${pathname.slice(1)}index.html`
      : pathname.slice(1);
    const requestedPath = resolve(outputRoot, relativePath);

    if (requestedPath !== outputRoot && !requestedPath.startsWith(outputRootPrefix)) {
      sendText(response, 403, "Forbidden");
      return;
    }

    try {
      const fileStats = await stat(requestedPath);

      if (!fileStats.isFile()) {
        throw new Error("Requested path is not a file");
      }

      response.writeHead(200, {
        "Content-Length": fileStats.size,
        "Content-Type": contentTypes.get(extname(requestedPath)) ?? "application/octet-stream",
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      createReadStream(requestedPath).pipe(response);
    } catch {
      sendText(response, 404, "Not Found");
    }
  });

  await new Promise((resolveListening, rejectListening) => {
    server.once("error", rejectListening);
    server.listen(port, host, () => {
      server.off("error", rejectListening);
      resolveListening();
    });
  });

  let closed = false;

  return {
    outputRoot,
    url: `http://${host}:${port}`,
    async close() {
      if (closed) {
        return;
      }

      closed = true;
      server.closeAllConnections();
      await new Promise((resolveClosed, rejectClosed) => {
        server.close((error) => {
          if (error) {
            rejectClosed(error);
            return;
          }

          resolveClosed();
        });
      });
    },
  };
}

const executablePath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;

if (import.meta.url === executablePath) {
  const staticServer = await startStaticServer();
  console.log(`Serving ${staticServer.outputRoot} at ${staticServer.url}`);

  const shutdown = async () => {
    await staticServer.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

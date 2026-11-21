// SUNSET PRESS — tiny static server for local use.
// Serves app/ on http://localhost:8080. No build step, no network.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root: string = path.join(path.dirname(fileURLToPath(import.meta.url)), "app");
const port: number = Number(process.env.PORT ?? 8080);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const full = path.join(root, rel);
  if (!full.startsWith(root)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  try {
    const data = await readFile(full);
    res.writeHead(200, { "content-type": TYPES[path.extname(full)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

server.listen(port, () => {
  console.log("SUNSET PRESS serving app/ on http://localhost:" + port);
});

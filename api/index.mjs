import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const worker = (await import("../dist/server/index.js")).default;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const assets = {
  async fetch(request) {
    const pathname = new URL(request.url).pathname.replace(/^\/+/, "");
    const filePath = path.resolve(projectRoot, "dist/client", pathname);
    if (!filePath.startsWith(path.resolve(projectRoot, "dist/client") + path.sep)) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const body = await readFile(filePath);
      return new Response(body, {
        headers: {
          "cache-control": "public, max-age=31536000, immutable",
          "content-type": mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },
};

export default async function handler(req, res) {
  const incoming = new URL(req.url || "/", "https://vercel.local");
  const pathname = incoming.searchParams.get("path") || "/";
  const query = new URLSearchParams(incoming.searchParams);
  query.delete("path");
  const target = new URL(pathname, "https://vercel.local");
  target.search = query.toString();

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  const request = new Request(target, {
    method: req.method,
    headers: req.headers,
    body,
    ...(body ? { duplex: "half" } : {}),
  });
  const response = await worker.fetch(request, { ASSETS: assets }, {});
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (req.method === "HEAD") return res.end();
  res.end(Buffer.from(await response.arrayBuffer()));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

import type { RequestHandler } from "express";

const BACKEND_PREFIXES = ["/api", "/trpc", "/socket.io"];

function isBackendPath(path: string): boolean {
  return BACKEND_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function spaFallback(indexHtml: string): RequestHandler {
  return (req, res, next) => {
    if (isBackendPath(req.path)) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  };
}

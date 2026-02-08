import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerRoutes } from "./features";
import { errorHandler, notFoundHandler } from "./middleware";
import { appRouter } from "@/trpc/router";
import { createContext } from "@/trpc/context";
import cors from "cors";

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({ origin: true, credentials: true }));

  registerRoutes(app);

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Serve client static files in production
  const clientDir = path.join(import.meta.dirname, "../../../public");
  const indexHtml = path.join(clientDir, "index.html");

  if (fs.existsSync(indexHtml)) {
    app.use(express.static(clientDir));

    // SPA catch-all: serve index.html for client-side routes
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

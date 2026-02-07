import express, { type Express } from "express";
import { registerRoutes } from "./features";
import { errorHandler, notFoundHandler } from "./middleware";
import cors from "cors";

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({ origin: true, credentials: true }));

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

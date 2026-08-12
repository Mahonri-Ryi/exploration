import express, { type Express, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NoteStore } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

export function createApp(store: NoteStore = new NoteStore()): Express {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/api/notes", (_req: Request, res: Response) => {
    res.json({ notes: store.list() });
  });

  app.post("/api/notes", (req: Request, res: Response) => {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    try {
      const note = store.add(text);
      res.status(201).json({ note });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.use(express.static(publicDir));

  return app;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBallotSchema } from "@shared/schema";
import { setupAuth, requireAuth } from "./auth";
import { updateNomineeWithTMDBData } from "./tmdb";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Public routes for accessing nominee data
  app.get("/api/nominees", async (_req, res) => {
    const nominees = await storage.getNominees();
    res.json(nominees);
  });

  app.get("/api/nominees/category/:category", async (req, res) => {
    const nominees = await storage.getNomineesByCategory(req.params.category);
    res.json(nominees);
  });

  app.get("/api/nominees/:id", async (req, res) => {
    const nominee = await storage.getNominee(parseInt(req.params.id));
    if (!nominee) {
      res.status(404).json({ message: "Nominee not found" });
      return;
    }
    res.json(nominee);
  });

  // Admin route to update TMDB data
  app.post("/api/nominees/:id/update-tmdb", requireAuth, async (req, res) => {
    if (!req.user?.isAdmin) {
      res.status(403).json({ message: "Unauthorized" });
      return;
    }

    const nominee = await storage.getNominee(parseInt(req.params.id));
    if (!nominee) {
      res.status(404).json({ message: "Nominee not found" });
      return;
    }

    const updatedNominee = await updateNomineeWithTMDBData(nominee);
    if (!updatedNominee) {
      res.status(500).json({ message: "Failed to update TMDB data" });
      return;
    }

    res.json(updatedNominee);
  });

  // Protected routes for ballot operations
  app.get("/api/ballots/:nomineeId", requireAuth, async (req, res) => {
    const ballot = await storage.getBallot(
      parseInt(req.params.nomineeId),
      req.user!.id
    );
    res.json(ballot || {
      nomineeId: parseInt(req.params.nomineeId),
      userId: req.user!.id,
      hasWatched: false,
      predictedWinner: false,
      wantToWin: false
    });
  });

  app.post("/api/ballots", requireAuth, async (req, res) => {
    const result = insertBallotSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Invalid ballot data" });
      return;
    }
    const ballot = await storage.updateBallot({
      ...result.data,
      userId: req.user!.id
    });
    res.json(ballot);
  });

  const httpServer = createServer(app);
  return httpServer;
}